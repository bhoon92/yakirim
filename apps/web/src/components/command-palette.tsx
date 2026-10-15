import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { listMembers } from '@/api/members';
import { listMissionaries } from '@/api/missionary';
import { listResidents } from '@/api/residents';
import { listCohorts } from '@/api/training';
import { isSubmitEnter } from '@/lib/keyboard';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { MemberDetailModal } from '@/routes/app/member-detail-modal';

export type PaletteNavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

type Result = { key: string; group: string; label: string; hint?: string; run: () => void };

/** 입력이 멈춘 뒤에만 교인 검색을 보낸다. */
function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const includes = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

/**
 * 노션의 ⌘K 처럼 — 어디서든 단축키로 메뉴·교인·간사·선교사·훈련 기수를 찾아 바로 간다.
 * 교인은 서버 검색(이름·전화번호), 나머지는 목록을 한 번 받아 화면에서 거른다(규모가 작다).
 * 권한이 없는 것은 찾지 않는다.
 */
export function CommandPalette({
  open,
  onOpenChange,
  navItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: PaletteNavItem[];
}) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [memberId, setMemberId] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const q = query.trim();
  const debounced = useDebounced(q, 200);

  // ⌘K / Ctrl+K — 입력칸 안에서도 연다(노션과 같음)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const members = useQuery({
    queryKey: ['palette', 'members', debounced],
    queryFn: () => listMembers({ q: debounced, pageSize: 6 }),
    enabled: open && debounced.length > 0 && can('member:read'),
  });
  const residents = useQuery({
    queryKey: ['palette', 'residents'],
    queryFn: () => listResidents({ scope: 'all' }),
    enabled: open && can('resident:read'),
    staleTime: 60_000,
  });
  const missionaries = useQuery({
    queryKey: ['palette', 'missionaries'],
    queryFn: () => listMissionaries({ scope: 'all' }),
    enabled: open && can('missionary:read'),
    staleTime: 60_000,
  });
  const cohorts = useQuery({
    queryKey: ['palette', 'cohorts'],
    queryFn: () => listCohorts(),
    enabled: open && can('training:read'),
    staleTime: 60_000,
  });

  const close = () => {
    onOpenChange(false);
    setQuery('');
    setActive(0);
  };
  const go = (to: string) => () => {
    close();
    navigate(to);
  };

  const results = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const item of navItems) {
      if (!q || includes(item.label, q)) out.push({ key: `nav-${item.to}`, group: '메뉴', label: item.label, run: go(item.to) });
    }
    if (!q) return out;
    for (const member of members.data?.items ?? []) {
      out.push({
        key: `member-${member.id}`,
        group: '교인',
        label: member.name,
        hint: member.statusName ?? undefined,
        run: () => {
          close();
          setMemberId(member.id);
        },
      });
    }
    if (can('member:read')) {
      out.push({
        key: 'search-members',
        group: '교인',
        label: `교인 명부에서 "${q}" 찾기`,
        run: go(`/app/members?q=${encodeURIComponent(q)}`),
      });
    }
    for (const resident of (residents.data ?? []).filter(row => includes(row.memberName, q)).slice(0, 5)) {
      out.push({
        key: `resident-${resident.id}`,
        group: '간사',
        label: resident.memberName,
        hint: resident.statusName ?? undefined,
        run: go('/app/residents'),
      });
    }
    for (const missionary of (missionaries.data ?? []).filter(row => includes(row.memberName, q)).slice(0, 5)) {
      out.push({
        key: `missionary-${missionary.id}`,
        group: '선교사',
        label: missionary.memberName,
        hint: missionary.stageName ?? undefined,
        run: go('/app/missionaries'),
      });
    }
    for (const cohort of (cohorts.data ?? []).filter(row => includes(row.label, q)).slice(0, 5)) {
      out.push({ key: `cohort-${cohort.id}`, group: '훈련 기수', label: cohort.label, run: go('/app/training') });
    }
    return out;
    // go/close 는 렌더마다 새로 만들어지지만 결과에는 영향이 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, navItems, members.data, residents.data, missionaries.data, cohorts.data, can]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(current => (current + step + results.length) % Math.max(results.length, 1));
    } else if (isSubmitEnter(event)) {
      event.preventDefault();
      results[active]?.run();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  let lastGroup = '';
  return (
    <>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[900] flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={close}>
            <div
              role="dialog"
              aria-label="빠른 이동"
              onMouseDown={event => event.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
                <Search className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
                <input
                  autoFocus
                  value={query}
                  onChange={event => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="메뉴·교인·간사·선교사·훈련 기수 찾기"
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
                />
                <kbd className="rounded border border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                  esc
                </kbd>
              </div>
              <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
                {results.map((result, index) => {
                  const header = result.group !== lastGroup ? result.group : null;
                  lastGroup = result.group;
                  return (
                    <li key={result.key}>
                      {header && (
                        <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[var(--color-muted-foreground)]">{header}</div>
                      )}
                      <button
                        type="button"
                        data-index={index}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={result.run}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                          index === active && 'bg-[var(--color-muted)]'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{result.label}</span>
                        {result.hint && <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">{result.hint}</span>}
                        {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />}
                      </button>
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-[var(--color-muted-foreground)]">찾는 게 없습니다</li>
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
      {memberId !== null && <MemberDetailModal memberId={memberId} onClose={() => setMemberId(null)} />}
    </>
  );
}
