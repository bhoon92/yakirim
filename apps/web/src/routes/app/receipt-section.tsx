import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { downloadReceipt } from '@/api/finance';
import { Button } from '@/components/ui/button';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export function ReceiptSection({ memberId }: { memberId: number }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [error, setError] = useState<string | null>(null);

  const downloadMut = useMutation({
    mutationFn: () => downloadReceipt(memberId, year),
    onMutate: () => setError(null),
    onError: (error: Error) => setError(error.message),
  });

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">기부금 영수증</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={event => setYear(Number(event.target.value))}
          className="h-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm outline-none focus:border-[var(--color-foreground)]"
        >
          {YEARS.map(yearOption => (
            <option key={yearOption} value={yearOption}>
              {yearOption}년
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => downloadMut.mutate()} disabled={downloadMut.isPending}>
          <Download className="size-3.5" />
          {downloadMut.isPending ? '생성 중…' : 'PDF 다운로드'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
