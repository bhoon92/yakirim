async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status} ${text}`);
  }
  return res.json();
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status} ${text}`);
  }
  return res.json();
}

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
}

// ── 대시보드 ─────────────────────────────
export type FinanceDashboard = {
  month: string;
  thisMonthOffering: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  fiscalYear: { id: number; name: string } | null;
  budget: { allocated: number; used: number; rate: number } | null;
};

export const fetchDashboard = () => getJson<FinanceDashboard>('/api/finance/dashboard');

// ── 회계연도 ─────────────────────────────
export type FiscalYear = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export const listFiscalYears = () => getJson<FiscalYear[]>('/api/finance/fiscal-years');
export const createFiscalYear = (body: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
  postJson<FiscalYear>('/api/finance/fiscal-years', body);
export const setCurrentFiscalYear = (id: number) => postJson<FiscalYear>(`/api/finance/fiscal-years/${id}/current`, {});

// ── 헌금 ─────────────────────────────────
export type Offering = {
  id: number;
  memberId: number;
  memberName: string | null;
  offeringCategoryId: number;
  categoryName: string | null;
  amount: number;
  date: string;
  rawDonorName: string | null;
  note: string | null;
};

export type OfferingList = { items: Offering[]; total: number; count: number };

export const listOfferings = (params: { date?: string; worshipServiceId?: number; memberId?: number }) => {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.worshipServiceId) q.set('worshipServiceId', String(params.worshipServiceId));
  if (params.memberId) q.set('memberId', String(params.memberId));
  return getJson<OfferingList>(`/api/finance/offerings?${q}`);
};

export const createOffering = (body: {
  memberId: number;
  offeringCategoryId: number;
  amount: number;
  date?: string;
  worshipServiceId?: number;
  rawDonorName?: string;
  note?: string;
}) => postJson<Offering>('/api/finance/offerings', body);

export const updateOffering = (
  id: number,
  body: Partial<{ memberId: number; offeringCategoryId: number; amount: number; date: string; note: string }>
) => patchJson<Offering>(`/api/finance/offerings/${id}`, body);

export const deleteOffering = (id: number) => del(`/api/finance/offerings/${id}`);

// ── 운영 거래 ─────────────────────────────
export type TransactionFlow = 'income' | 'expense';

export type Transaction = {
  id: number;
  flow: TransactionFlow;
  amount: number;
  title: string;
  date: string;
  accountCategoryId: number | null;
  categoryName: string | null;
  budgetAllocationId: number | null;
  note: string | null;
};

export const listTransactions = () => getJson<Transaction[]>('/api/finance/transactions');
export const createTransaction = (body: {
  flow: TransactionFlow;
  amount: number;
  title: string;
  date?: string;
  accountCategoryId?: number;
  fiscalYearId?: number;
  budgetAllocationId?: number;
  note?: string;
}) => postJson<Transaction>('/api/finance/transactions', body);
export const deleteTransaction = (id: number) => del(`/api/finance/transactions/${id}`);

// ── 부서별 예산 ───────────────────────────
export type BudgetTargetKind = 'department' | 'ministry' | 'small_group';

export const BUDGET_KIND_LABEL: Record<BudgetTargetKind, string> = {
  department: '기관',
  ministry: '사역팀',
  small_group: '공동체',
};

export type Budget = {
  id: number;
  fiscalYearId: number;
  targetKind: BudgetTargetKind;
  targetId: number;
  targetName: string | null;
  allocated: number;
  used: number;
  remaining: number;
  rate: number;
  note: string | null;
};

export const listBudgets = (fiscalYearId?: number) =>
  getJson<Budget[]>(`/api/finance/budgets${fiscalYearId ? `?fiscalYearId=${fiscalYearId}` : ''}`);
export const createBudget = (body: {
  fiscalYearId: number;
  targetKind: BudgetTargetKind;
  targetId: number;
  amount: number;
  note?: string;
}) => postJson<Budget>('/api/finance/budgets', body);
export const deleteBudget = (id: number) => del(`/api/finance/budgets/${id}`);

// ── 카테고리 (헌금 종류 / 계정과목) ────────
export type Category = { id: number; name: string };

export const listOfferingCategories = () => getJson<Category[]>('/api/offering-categories');
export const createOfferingCategory = (name: string) => postJson<Category>('/api/offering-categories', { name });
export const updateOfferingCategory = (id: number, name: string) => patchJson<Category>(`/api/offering-categories/${id}`, { name });
export const deleteOfferingCategory = (id: number) => del(`/api/offering-categories/${id}`);
export const listAccountCategories = () => getJson<Category[]>('/api/account-categories');
export const createAccountCategory = (name: string) => postJson<Category>('/api/account-categories', { name });
export const updateAccountCategory = (id: number, name: string) => patchJson<Category>(`/api/account-categories/${id}`, { name });
export const deleteAccountCategory = (id: number) => del(`/api/account-categories/${id}`);

export function formatKRW(amount: number): string {
  return `₩ ${amount.toLocaleString()}`;
}

// ── 연말정산 기부금영수증 PDF ──────────────
/** 영수증 PDF 다운로드. 실패 시 서버 메시지로 throw. */
export async function downloadReceipt(memberId: number, year: number): Promise<void> {
  const res = await fetch(`/api/finance/offerings/receipt/${memberId}/${year}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `영수증 발급 실패 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) {
        const raw = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        message = String(raw).replace(/^\w*Exception:\s*/, '');
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `donation-receipt-${year}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
