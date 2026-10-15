import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { listMembers } from '@/api/members';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** 교인 검색 → 선택. 선택 시 memberId + 이름 콜백. */
export function MemberPicker({
  selectedName,
  onSelect,
}: {
  selectedName: string | null;
  onSelect: (member: { id: number; name: string }) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['members', { q: searchQuery, page: 1, pageSize: 8 }],
    queryFn: () => listMembers({ q: searchQuery || undefined, page: 1, pageSize: 8 }),
    enabled: open,
  });

  const items = data?.items ?? [];

  return (
    <div className="relative">
      <Input
        value={open ? searchQuery : (selectedName ?? '')}
        placeholder="교인 검색…"
        onFocus={() => setOpen(true)}
        onChange={event => {
          setSearchQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-1 shadow-md">
          {items.map(member => (
            <li key={member.id}>
              <button
                type="button"
                onMouseDown={event => {
                  event.preventDefault();
                  onSelect({ id: member.id, name: member.name });
                  setSearchQuery('');
                  setOpen(false);
                }}
                className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]')}
              >
                <span className="font-medium">{member.name}</span>
                {member.phone && <span className="text-xs text-[var(--color-muted-foreground)]">{member.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
