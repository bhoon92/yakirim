import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { toDateString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberService } from '@src/module/member/member.service';

/** 서식의 열 — 교인 명부 내보내기와 같은 구성이라 내보내기→수정→가져오기 왕복이 된다. */
const COLUMNS = ['이름', '연락처', '생년월일', '재적상태', '등록일', '세례일', '직업', '주소'] as const;

const SHEET_NAME = '재적 명부';

export type ImportRowError = { row: number; name: string; message: string };

export type ImportMembersResult = {
  /** 실제로 반영했는지. dryRun 이면 false */
  applied: boolean;
  /** 데이터가 있던 행 수 (헤더 제외) */
  total: number;
  created: number;
  updated: number;
  /** 바꿀 내용이 없어 건너뛴 행 */
  unchanged: number;
  errors: ImportRowError[];
};

type ParsedRow = {
  rowNumber: number;
  name: string;
  phone?: string;
  birth?: string;
  statusName?: string;
  registeredAt?: string;
  baptizedAt?: string;
  occupation?: string;
  address?: string;
};

@Injectable()
export class ImportService {
  constructor(private readonly members: MemberService) {}

  /** 빈 서식 — 헤더 + 예시 한 줄 + 이 교회에서 쓸 수 있는 재적상태 안내 시트. */
  async membersTemplate(churchId: number): Promise<Buffer> {
    const statuses = await this.activeStatuses(churchId);

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.columns = COLUMNS.map(header => ({ header, key: header, width: header === '주소' ? 28 : 14 }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      이름: '홍길동',
      연락처: '010-1234-5678',
      생년월일: '1990-03-01',
      재적상태: statuses[0]?.name ?? '',
      등록일: '2026-01-05',
      세례일: '',
      직업: '회사원',
      주소: '서울시 …',
    });

    const guide = workbook.addWorksheet('안내');
    guide.columns = [
      { header: '항목', key: 'key', width: 16 },
      { header: '설명', key: 'value', width: 70 },
    ];
    guide.getRow(1).font = { bold: true };
    for (const [key, value] of [
      ['이름', '필수. 이 열이 비어 있으면 그 행은 건너뜁니다.'],
      ['연락처', '선택. 같은 이름이 여러 명일 때 이 값으로 구분합니다.'],
      ['날짜 형식', 'YYYY-MM-DD (예: 1990-03-01). 엑셀 날짜 셀도 인식합니다.'],
      ['재적상태', `아래 값 중 하나. 비우면 첫 단계로 등록됩니다 — ${statuses.map(status => status.name).join(' / ')}`],
      ['중복 처리', '이름+연락처가 이미 있으면 수정하고, 없으면 새로 만듭니다. 빈 칸은 기존 값을 덮지 않습니다.'],
      ['첫 시트만', `'${SHEET_NAME}' 시트만 읽습니다. 이 '안내' 시트는 무시됩니다.`],
    ]) {
      guide.addRow({ key, value });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * 엑셀 → 교인 명부.
   *
   * 행 단위로 처리하고 실패한 행만 오류로 모은다 — 한 줄 오타 때문에 300줄이 통째로 막히면
   * 담당자가 파일을 고칠 근거도 못 얻는다. 그래서 전체 트랜잭션으로 묶지 않는다.
   * 대신 `dryRun` 으로 결과를 먼저 볼 수 있게 했다.
   */
  async importMembers(churchId: number, buffer: Buffer, dryRun: boolean): Promise<ImportMembersResult> {
    const rows = await this.parse(buffer);
    const statuses = await this.activeStatuses(churchId);
    const statusByName = new Map(statuses.map(status => [status.name.trim(), status.id]));

    const result: ImportMembersResult = { applied: !dryRun, total: rows.length, created: 0, updated: 0, unchanged: 0, errors: [] };

    for (const row of rows) {
      try {
        let statusId: number | undefined;
        if (row.statusName) {
          statusId = statusByName.get(row.statusName);
          if (!statusId) {
            throw new Error(`재적상태 '${row.statusName}' 는 이 교회에 없습니다. (${statuses.map(s => s.name).join(' / ')})`);
          }
        }

        const existing = await this.findExisting(churchId, row);
        const patch = {
          phone: row.phone,
          birth: row.birth,
          registeredAt: row.registeredAt,
          baptizedAt: row.baptizedAt,
          occupation: row.occupation,
          address: row.address,
          ...(statusId ? { statusId } : {}),
        };

        if (existing) {
          // 빈 칸으로 기존 값을 지우지 않는다 — 일부 열만 채운 파일을 올리는 게 흔하다.
          const changes = Object.fromEntries(
            Object.entries(patch).filter(([key, value]) => value !== undefined && value !== (existing as never)[key])
          );
          if (Object.keys(changes).length === 0) {
            result.unchanged += 1;
            continue;
          }
          if (!dryRun) await this.members.update(churchId, existing.id, changes);
          result.updated += 1;
        } else {
          // MemberService.create 를 거쳐야 재적상태 이력이 함께 적립된다.
          if (!dryRun) await this.members.create(churchId, { name: row.name, ...patch });
          result.created += 1;
        }
      } catch (error) {
        result.errors.push({ row: row.rowNumber, name: row.name, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return result;
  }

  /** 이름+연락처로 찾고, 연락처가 없으면 이름이 유일할 때만 같은 사람으로 본다. */
  private async findExisting(churchId: number, row: ParsedRow): Promise<MemberEntity | null> {
    const repo = DataSources.instance.getRepository(MemberEntity);
    if (row.phone) {
      return repo.findOne({ where: { churchId, name: row.name, phone: row.phone } });
    }
    const sameName = await repo.find({ where: { churchId, name: row.name }, take: 2 });
    if (sameName.length > 1) {
      throw new Error(`같은 이름이 ${sameName.length}명 이상 있습니다. 연락처를 채워 구분해 주세요.`);
    }
    return sameName[0] ?? null;
  }

  private async activeStatuses(churchId: number): Promise<MemberStatusEntity[]> {
    return DataSources.instance
      .getRepository(MemberStatusEntity)
      .find({ where: { churchId, isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  private async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException('엑셀 파일(.xlsx)로 읽을 수 없습니다. 서식을 내려받아 그 파일에 채워 주세요.');
    }

    const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('시트가 비어 있습니다.');

    // 헤더 위치를 이름으로 찾는다 — 열 순서를 바꿔도 읽히게.
    const header = sheet.getRow(1);
    const indexOf = new Map<string, number>();
    header.eachCell((cell, colNumber) => {
      const label = String(cell.value ?? '').trim();
      if (label) indexOf.set(label, colNumber);
    });
    if (!indexOf.has('이름')) {
      throw new BadRequestException(`'이름' 열을 찾지 못했습니다. 첫 줄이 머리글이어야 합니다. (필요한 열: ${COLUMNS.join(', ')})`);
    }

    const rows: ParsedRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const text = (label: string) => cellText(row.getCell(indexOf.get(label) ?? -1)?.value);
      const name = text('이름');
      if (!name) return; // 빈 줄은 조용히 건너뛴다

      rows.push({
        rowNumber,
        name,
        phone: text('연락처') || undefined,
        birth: cellDate(row.getCell(indexOf.get('생년월일') ?? -1)?.value),
        statusName: text('재적상태') || undefined,
        registeredAt: cellDate(row.getCell(indexOf.get('등록일') ?? -1)?.value),
        baptizedAt: cellDate(row.getCell(indexOf.get('세례일') ?? -1)?.value),
        occupation: text('직업') || undefined,
        address: text('주소') || undefined,
      });
    });

    return rows;
  }
}

/** 셀 → 문자열. 수식·리치텍스트도 표시값으로 뽑는다. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const rich = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(rich.richText))
      return rich.richText
        .map(part => part.text)
        .join('')
        .trim();
    if (rich.text !== undefined) return String(rich.text).trim();
    if (rich.result !== undefined) return String(rich.result).trim();
    if (value instanceof Date) return toDateString(value);
  }
  return String(value).trim();
}

/** 셀 → 'YYYY-MM-DD'. 엑셀 날짜 셀(Date)과 문자열 둘 다 받는다. 형식이 아니면 undefined. */
function cellDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return toDateString(value);
  const text = cellText(value);
  if (!text) return undefined;
  const normalized = text.replace(/[./]/g, '-');
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized) ? normalized.replace(/^(\d{4})-(\d)-/, '$1-0$2-').replace(/-(\d)$/, '-0$1') : undefined;
}
