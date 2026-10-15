/** 인증 쿠키로 .xlsx 를 받아 다운로드 트리거. */
async function downloadXlsx(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`export ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export const exportOfferings = (year: number) => downloadXlsx(`/api/export/offerings/${year}`, `offerings-${year}.xlsx`);
export const exportTransactions = () => downloadXlsx('/api/export/transactions', 'transactions.xlsx');
export const exportBudgets = (fiscalYearId?: number) =>
  downloadXlsx(`/api/export/budgets${fiscalYearId ? `?fiscalYearId=${fiscalYearId}` : ''}`, 'budgets.xlsx');
export const exportMembers = () => downloadXlsx('/api/export/members', 'members.xlsx');
