import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createOffering,
  createOfferingCategory,
  deleteOffering,
  deleteOfferingCategory,
  formatKRW,
  listOfferingCategories,
  listOfferings,
  updateOffering,
  updateOfferingCategory,
  type Category,
  type Offering,
} from '@/api/finance';
import { exportOfferings } from '@/api/exports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Check, Download, Pencil, Trash2 } from 'lucide-react';
import { usePermissions } from '@/lib/permissions';
import { todayString } from '@/lib/date';
import { CategorySelect } from './category-select';
import { MemberPicker } from './member-picker';
import { isSubmitEnter } from '@/lib/keyboard';

export function OfferingsView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('finance:write');
  const today = todayString();
  const [date, setDate] = useState(today);

  const { data: list } = useQuery({
    queryKey: ['finance', 'offerings', date],
    queryFn: () => listOfferings({ date }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['finance', 'offering-categories'],
    queryFn: listOfferingCategories,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'offerings', date] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
  };

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { offeringCategoryId: number; amount: number } }) => updateOffering(id, body),
    onSuccess: invalidate,
    onError: (error: Error) => alert(`수정 실패: ${error.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: deleteOffering,
    onSuccess: invalidate,
    onError: (error: Error) => alert(`삭제 실패: ${error.message}`),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">입력 날짜</span>
            <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-44" />
            {canWrite && <Badge tone="accent">빠른 입력</Badge>}
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void exportOfferings(Number(date.slice(0, 4)))}>
              <Download className="size-3.5" />
              {date.slice(0, 4)}년 엑셀
            </Button>
          </div>
          {canWrite && <OfferingForm date={date} onCreated={invalidate} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-2 text-xs font-medium text-[var(--color-muted-foreground)]">
            <div className="col-span-5">교인</div>
            <div className="col-span-3">분류</div>
            <div className="col-span-4 text-right">금액</div>
          </div>
          {!list || list.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">이 날짜의 헌금 기록이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {list.items.map(offering => (
                <OfferingRow
                  key={offering.id}
                  offering={offering}
                  categories={categories}
                  canWrite={canWrite}
                  saving={updateMut.isPending}
                  onSave={(id, body) => updateMut.mutate({ id, body })}
                  onDelete={id => deleteMut.mutate(id)}
                />
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm">
            <span className="text-[var(--color-muted-foreground)]">총 {list?.count ?? 0}건</span>
            <span className="font-semibold tabular-nums">{formatKRW(list?.total ?? 0)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OfferingRow({
  offering,
  categories,
  canWrite,
  saving,
  onSave,
  onDelete,
}: {
  offering: Offering;
  categories: Category[];
  canWrite: boolean;
  saving: boolean;
  onSave: (id: number, body: { offeringCategoryId: number; amount: number }) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState(offering.offeringCategoryId);
  const [amount, setAmount] = useState(String(offering.amount));

  const startEdit = () => {
    setCategoryId(offering.offeringCategoryId);
    setAmount(String(offering.amount));
    setEditing(true);
  };

  const save = () => {
    const value = Number(amount.replace(/[^0-9]/g, ''));
    if (!categoryId || !value) return;
    onSave(offering.id, { offeringCategoryId: categoryId, amount: value });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="space-y-2.5 bg-[var(--color-muted)] px-5 py-3">
        <div className="text-sm font-medium">{offering.memberName ?? offering.rawDonorName ?? '(미상)'}</div>
        <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            onKeyDown={event => {
              if (isSubmitEnter(event)) save();
              if (event.key === 'Escape') setEditing(false);
            }}
            className="w-40 text-right tabular-nums"
            autoFocus
          />
          <Button size="sm" onClick={save} disabled={!categoryId || !amount || saving}>
            <Check className="size-3.5" />
            저장
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-12 items-center gap-4 px-5 py-3">
      <div className="col-span-5 text-sm font-medium">{offering.memberName ?? offering.rawDonorName ?? '(미상)'}</div>
      <div className="col-span-3">
        <Badge tone="muted">{offering.categoryName ?? '—'}</Badge>
      </div>
      <div className="col-span-4 flex items-center justify-end gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{formatKRW(offering.amount)}</span>
        {canWrite && (
          <>
            <button
              onClick={startEdit}
              className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              aria-label="수정"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm('이 헌금 기록을 삭제할까요?')) onDelete(offering.id);
              }}
              className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
              aria-label="삭제"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function OfferingForm({ date, onCreated }: { date: string; onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [member, setMember] = useState<{ id: number; name: string } | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['finance', 'offering-categories'],
    queryFn: listOfferingCategories,
  });

  const invalidateCategories = () => queryClient.invalidateQueries({ queryKey: ['finance', 'offering-categories'] });

  const createCategoryMut = useMutation({
    mutationFn: createOfferingCategory,
    onSuccess: created => {
      invalidateCategories();
      setCategoryId(created.id);
    },
  });

  const updateCategoryMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateOfferingCategory(id, name),
    onSuccess: invalidateCategories,
    onError: (error: Error) => alert(`분류 수정 실패: ${error.message}`),
  });

  const deleteCategoryMut = useMutation({
    mutationFn: deleteOfferingCategory,
    onSuccess: (_data, id) => {
      invalidateCategories();
      if (categoryId === id) setCategoryId(null);
    },
    onError: (error: Error) => alert(`분류 삭제 실패: ${error.message}`),
  });

  const createMut = useMutation({
    mutationFn: createOffering,
    onSuccess: () => {
      setMember(null);
      setAmount('');
      onCreated();
    },
    onError: (error: Error) => alert(`추가 실패: ${error.message}`),
  });

  const submit = () => {
    const value = Number(amount.replace(/[^0-9]/g, ''));
    if (!member || !categoryId || !value) return;
    createMut.mutate({ memberId: member.id, offeringCategoryId: categoryId, amount: value, date });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <MemberPicker selectedName={member?.name ?? null} onSelect={setMember} />
        </div>
        <Input
          inputMode="numeric"
          placeholder="금액"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          onKeyDown={event => {
            if (isSubmitEnter(event)) submit();
          }}
          className="w-40 text-right tabular-nums"
        />
        <Button onClick={submit} disabled={!member || !categoryId || !amount || createMut.isPending}>
          추가
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-xs font-medium text-[var(--color-muted-foreground)]">분류</span>
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          onCreate={name => createCategoryMut.mutate(name)}
          creating={createCategoryMut.isPending}
          onUpdate={(id, name) => updateCategoryMut.mutate({ id, name })}
          onDelete={id => deleteCategoryMut.mutate(id)}
        />
      </div>
    </div>
  );
}
