import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Borders, Workbook, Worksheet } from 'exceljs';
import { DataSources } from '@src/database/data-sources';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { TrainingCourseEntity } from '@src/database/entities/training-course.entity';
import { WorshipServiceEntity } from '@src/database/entities/worship-service.entity';
import { EnrollmentStatus } from '@src/database/entities/training-enrollment.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { BudgetService } from '@src/module/finance/budget.service';
import { OfferingService } from '@src/module/finance/offering.service';
import { TransactionService } from '@src/module/finance/transaction.service';
import { MemberService } from '@src/module/member/member.service';
import { MissionaryService } from '@src/module/missionary/missionary.service';
import { ResidentService } from '@src/module/resident/resident.service';

const KIND_LABEL: Record<string, string> = { department: '부서', ministry: '사역팀', small_group: '공동체' };

/** 웹 ENROLLMENT_STATUS_LABEL 과 같은 말. */
const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  [EnrollmentStatus.ENROLLED]: '수강 중',
  [EnrollmentStatus.COMPLETED]: '수료',
  [EnrollmentStatus.DROPPED]: '중도포기',
};

/** 출석부 맨 아래에 남겨 두는 빈 줄 — 그날 처음 온 분 이름을 손으로 적는 칸. */
const ATTENDANCE_SHEET_BLANK_ROWS = 8;

const THIN_BORDER: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

/** 그 달(YYYY-MM)의 주일 날짜들 (YYYY-MM-DD). UTC 로 계산해 서버 시간대와 무관하다. */
export function sundaysOf(month: string): string[] {
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];
  const result: string[] = [];
  for (let day = new Date(Date.UTC(year, monthIndex, 1)); day.getUTCMonth() === monthIndex; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() === 0) result.push(day.toISOString().slice(0, 10));
  }
  return result;
}

const names = (tags: { name: string | null }[]) =>
  tags
    .map(tag => tag.name ?? '')
    .filter(Boolean)
    .join(', ');

@Injectable()
export class ExportService {
  constructor(
    private readonly offerings: OfferingService,
    private readonly transactions: TransactionService,
    private readonly budgets: BudgetService,
    private readonly members: MemberService,
    private readonly residents: ResidentService,
    private readonly missionaries: MissionaryService,
    private readonly affiliations: AffiliationService
  ) {}

  /** 헌금 내역 (연도 기준). */
  async offerings_xlsx(churchId: number, year: number): Promise<Buffer> {
    const items = await this.offerings.listByDateRange(churchId, `${year}-01-01`, `${year}-12-31`);
    const wb = new Workbook();
    const ws = wb.addWorksheet(`${year} 헌금`);
    this.setColumns(ws, [
      { header: '날짜', key: 'date', width: 14 },
      { header: '성도', key: 'member', width: 16 },
      { header: '분류', key: 'category', width: 14 },
      { header: '금액', key: 'amount', width: 16 },
      { header: '봉투명', key: 'raw', width: 16 },
      { header: '비고', key: 'note', width: 24 },
    ]);
    for (const offering of items) {
      ws.addRow({
        date: offering.date,
        member: offering.memberName ?? offering.rawDonorName ?? '(미상)',
        category: offering.categoryName ?? '',
        amount: offering.amount,
        raw: offering.rawDonorName ?? '',
        note: offering.note ?? '',
      });
    }
    this.currencyColumn(ws, 'amount');
    this.totalRow(ws, { label: '합계', labelKey: 'category', sumKey: 'amount', count: items.length });
    return this.toBuffer(wb);
  }

  /** 운영 거래 내역. */
  async transactions_xlsx(churchId: number): Promise<Buffer> {
    const rows = await this.transactions.list(churchId);
    const wb = new Workbook();
    const ws = wb.addWorksheet('운영 거래');
    this.setColumns(ws, [
      { header: '날짜', key: 'date', width: 14 },
      { header: '구분', key: 'flow', width: 8 },
      { header: '계정과목', key: 'category', width: 16 },
      { header: '적요', key: 'title', width: 28 },
      { header: '수입', key: 'income', width: 16 },
      { header: '지출', key: 'expense', width: 16 },
    ]);
    for (const transaction of rows) {
      ws.addRow({
        date: transaction.date,
        flow: transaction.flow === 'income' ? '수입' : '지출',
        category: transaction.categoryName ?? '',
        title: transaction.title,
        income: transaction.flow === 'income' ? transaction.amount : null,
        expense: transaction.flow === 'expense' ? transaction.amount : null,
      });
    }
    this.currencyColumn(ws, 'income');
    this.currencyColumn(ws, 'expense');
    return this.toBuffer(wb);
  }

  /** 부서별 예산. */
  async budgets_xlsx(churchId: number, fiscalYearId?: number): Promise<Buffer> {
    const items = await this.budgets.list(churchId, fiscalYearId);
    const wb = new Workbook();
    const ws = wb.addWorksheet('부서별 예산');
    this.setColumns(ws, [
      { header: '구분', key: 'kind', width: 10 },
      { header: '대상', key: 'target', width: 18 },
      { header: '할당', key: 'allocated', width: 16 },
      { header: '사용', key: 'used', width: 16 },
      { header: '잔여', key: 'remaining', width: 16 },
      { header: '집행률(%)', key: 'rate', width: 10 },
    ]);
    for (const allocation of items) {
      ws.addRow({
        kind: KIND_LABEL[allocation.targetKind] ?? allocation.targetKind,
        target: allocation.targetName ?? '',
        allocated: allocation.allocated,
        used: allocation.used,
        remaining: allocation.remaining,
        rate: allocation.rate,
      });
    }
    for (const key of ['allocated', 'used', 'remaining']) this.currencyColumn(ws, key);
    return this.toBuffer(wb);
  }

  /** 재적 명부. */
  async members_xlsx(churchId: number): Promise<Buffer> {
    const rows = await this.members.listAll(churchId);
    const statuses = await DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } });
    const statusName = new Map(statuses.map(status => [status.id, status.name]));
    const wb = new Workbook();
    const ws = wb.addWorksheet('재적 명부');
    this.setColumns(ws, [
      { header: '이름', key: 'name', width: 14 },
      { header: '연락처', key: 'phone', width: 16 },
      { header: '생년월일', key: 'birth', width: 14 },
      { header: '재적상태', key: 'stage', width: 10 },
      { header: '등록일', key: 'registeredAt', width: 14 },
      { header: '세례일', key: 'baptizedAt', width: 14 },
      { header: '직업', key: 'occupation', width: 14 },
      { header: '주소', key: 'address', width: 28 },
    ]);
    for (const member of rows) {
      ws.addRow({
        name: member.name,
        phone: member.phone ?? '',
        birth: member.birth ?? '',
        stage: statusName.get(member.statusId) ?? '',
        registeredAt: member.registeredAt ?? '',
        baptizedAt: member.baptizedAt ?? '',
        occupation: member.occupation ?? '',
        address: member.address ?? '',
      });
    }
    return this.toBuffer(wb);
  }

  /**
   * 종이 출석부 — 인쇄해서 손으로 체크하는 양식. 그 달 주일마다 빈 칸 하나.
   * 출석 화면 명단과 같은 사람(재적상태 countsInRoster)만, 이름 가나다순. 맨 아래에 새로 온 분을 적을 빈 줄을 둔다.
   * A4 가로 한 장 너비에 맞추고, 여러 장이 되면 머리글 줄을 매 장 반복한다.
   */
  async attendance_sheet_xlsx(churchId: number, month: string, worshipServiceId?: number): Promise<Buffer> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month 는 YYYY-MM 형식이어야 합니다');
    const [church, service, members, statuses] = await Promise.all([
      DataSources.instance.getRepository(ChurchEntity).findOne({ where: { id: churchId } }),
      worshipServiceId
        ? DataSources.instance.getRepository(WorshipServiceEntity).findOne({ where: { id: worshipServiceId, churchId } })
        : Promise.resolve(null),
      this.members.listAll(churchId),
      DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } }),
    ]);
    if (worshipServiceId && !service) throw new NotFoundException('Worship service not found');
    const statusMap = new Map(statuses.map(status => [status.id, status]));
    const roster = members.filter(member => statusMap.get(member.statusId)?.countsInRoster !== false);
    const affiliations = await this.affiliations.currentForMembers(
      churchId,
      roster.map(member => member.id)
    );
    const sundays = sundaysOf(month);

    const wb = new Workbook();
    const ws = wb.addWorksheet(`${month} 출석부`, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
        printTitlesRow: '2:2',
      },
      headerFooter: { oddFooter: '&C&P / &N' },
    });
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'name', width: 14 },
      { key: 'smallGroup', width: 14 },
      { key: 'status', width: 10 },
      ...sundays.map(date => ({ key: date, width: 9 })),
      { key: 'note', width: 22 },
    ];
    const lastColumn = ws.columns.length;

    const [year, monthNumber] = [month.slice(0, 4), Number(month.slice(5, 7))];
    const title = `${church?.name ?? ''} 출석부 — ${year}년 ${monthNumber}월${service ? ` (${service.name})` : ''}`.trim();
    ws.mergeCells(1, 1, 1, lastColumn);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    const header = ws.addRow([
      '번호',
      '이름',
      '목장',
      '재적상태',
      ...sundays.map(date => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`),
      '비고',
    ]);
    header.font = { bold: true };
    header.height = 24;
    header.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    roster.forEach((member, index) => {
      ws.addRow([
        index + 1,
        member.name,
        names(affiliations.get(member.id)?.smallGroups ?? []),
        statusMap.get(member.statusId)?.name ?? '',
        ...sundays.map(() => ''),
        '',
      ]);
    });
    for (let index = 0; index < ATTENDANCE_SHEET_BLANK_ROWS; index++) ws.addRow([roster.length + index + 1]);
    const total = ws.addRow(['', '출석 인원', '', '', ...sundays.map(() => ''), '']);
    total.font = { bold: true };

    for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
      const row = ws.getRow(rowNumber);
      if (rowNumber > 2) row.height = 24; // 손으로 체크하기 넉넉하게
      for (let column = 1; column <= lastColumn; column++) {
        const cell = row.getCell(column);
        cell.border = THIN_BORDER;
        if (rowNumber > 2)
          cell.alignment = { vertical: 'middle', horizontal: column === 1 || (column > 4 && column < lastColumn) ? 'center' : 'left' };
      }
    }
    ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 2 }];
    return this.toBuffer(wb);
  }

  /** 간사 명부 — 화면(간사 목록)과 같은 데이터. 지금 공동체에 없는 사람(퇴소 등)도 함께 내보내고 "현재 간사" 열로 구분한다. */
  async residents_xlsx(churchId: number): Promise<Buffer> {
    const [rows, courses] = await Promise.all([
      this.residents.list(churchId, {}),
      DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId }, withDeleted: true }),
    ]);
    const courseName = new Map(courses.map(course => [course.id, course.name]));
    const wb = new Workbook();
    const ws = wb.addWorksheet('간사 명부');
    this.setColumns(ws, [
      { header: '이름', key: 'name', width: 12 },
      { header: '연락처', key: 'phone', width: 16 },
      { header: '상태', key: 'status', width: 10 },
      { header: '현재 간사', key: 'active', width: 10 },
      { header: '입주일', key: 'joinedAt', width: 12 },
      { header: '헌신일', key: 'committedAt', width: 12 },
      { header: '퇴소일', key: 'leftAt', width: 12 },
      { header: '하우스', key: 'smallGroups', width: 16 },
      { header: '사역팀', key: 'ministries', width: 20 },
      { header: '역할', key: 'position', width: 10 },
      { header: '맡은 사역', key: 'duties', width: 20 },
      { header: '훈련', key: 'training', width: 30 },
      { header: '맡은 성도', key: 'flockCount', width: 10 },
      { header: '메모', key: 'note', width: 30 },
    ]);
    for (const resident of rows) {
      ws.addRow({
        name: resident.memberName,
        phone: resident.phone ?? '',
        status: resident.statusName ?? '',
        active: resident.statusCountsAsActive ? '예' : '아니오',
        joinedAt: resident.joinedAt ?? '',
        committedAt: resident.committedAt ?? '',
        leftAt: resident.leftAt ?? '',
        smallGroups: names(resident.smallGroups),
        ministries: names(resident.ministries),
        position: resident.position?.name ?? '',
        duties: names(resident.duties),
        training: resident.training
          .map(step => `${courseName.get(step.courseId) ?? '(삭제된 과정)'} ${ENROLLMENT_LABEL[step.status] ?? step.status}`)
          .join(', '),
        flockCount: resident.flockCount,
        note: resident.note ?? '',
      });
    }
    return this.toBuffer(wb);
  }

  /** 선교사 명부 — 단계가 집계(countsAsActive) 단계인지를 "현재 파송" 열로 함께 준다 (대시보드 "현재 파송"과 같은 기준). */
  async missionaries_xlsx(churchId: number): Promise<Buffer> {
    const rows = await this.missionaries.list(churchId, {});
    const wb = new Workbook();
    const ws = wb.addWorksheet('선교사 명부');
    this.setColumns(ws, [
      { header: '이름', key: 'name', width: 12 },
      { header: '단계', key: 'stage', width: 12 },
      { header: '현재 파송', key: 'active', width: 10 },
      { header: '파송 국가', key: 'country', width: 12 },
      { header: '지역', key: 'region', width: 14 },
      { header: '사역 내용', key: 'fieldWork', width: 24 },
      { header: '파송 사역팀', key: 'ministry', width: 14 },
      { header: '파송일', key: 'commissionedAt', width: 12 },
      { header: '출국일', key: 'departedAt', width: 12 },
      { header: '종료일', key: 'endedAt', width: 12 },
      { header: '메모', key: 'note', width: 30 },
    ]);
    for (const missionary of rows) {
      ws.addRow({
        name: missionary.memberName,
        stage: missionary.stageName ?? '단계 미지정',
        active: missionary.stageCountsAsActive ? '예' : '아니오',
        country: missionary.country ?? '',
        region: missionary.region ?? '',
        fieldWork: missionary.fieldWork ?? '',
        ministry: missionary.ministryName ?? '',
        commissionedAt: missionary.commissionedAt ?? '',
        departedAt: missionary.departedAt ?? '',
        endedAt: missionary.endedAt ?? '',
        note: missionary.note ?? '',
      });
    }
    return this.toBuffer(wb);
  }

  private setColumns(ws: Worksheet, columns: { header: string; key: string; width: number }[]) {
    ws.columns = columns;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  }

  private currencyColumn(ws: Worksheet, key: string) {
    ws.getColumn(key).numFmt = '#,##0';
  }

  private totalRow(ws: Worksheet, opts: { label: string; labelKey: string; sumKey: string; count: number }) {
    const total = ws.getColumn(opts.sumKey).values.reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    const row = ws.addRow({ [opts.labelKey]: `${opts.label} (${opts.count}건)`, [opts.sumKey]: total });
    row.font = { bold: true };
  }

  private async toBuffer(wb: Workbook): Promise<Buffer> {
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
