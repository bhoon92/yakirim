import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { DataSources } from '@src/database/data-sources';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { BudgetService } from '@src/module/finance/budget.service';
import { OfferingService } from '@src/module/finance/offering.service';
import { TransactionService } from '@src/module/finance/transaction.service';
import { MemberService } from '@src/module/member/member.service';

const KIND_LABEL: Record<string, string> = { department: '부서', ministry: '사역팀', small_group: '목장' };

@Injectable()
export class ExportService {
  constructor(
    private readonly offerings: OfferingService,
    private readonly transactions: TransactionService,
    private readonly budgets: BudgetService,
    private readonly members: MemberService
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
