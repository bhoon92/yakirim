import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Globe2,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  SquareKanban,
  Users,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/auth/auth-context';
import { ChurchBrandingProvider, useChurchBranding } from '@/branding/church-branding';
import { ChurchLogo } from '@/branding/church-logo';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CommandPalette } from '@/components/command-palette';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  end?: boolean;
};

type NavGroup = {
  /** 섹션 라벨. null 이면 라벨 없이 최상단에 붙는다(홈). */
  label: string | null;
  items: NavItem[];
};

/**
 * flex 처럼 메뉴를 성격별로 묶는다. 평평한 9개 목록은 훑기 어렵다.
 * 순서 = 이 교회의 우선순위 (양성이 사역·운영보다 먼저).
 * 양성 안에서는 공동체 간사가 맨 위다 — 이 교회 구성원의 중심이 공동생활을 하는 간사들이다.
 */
const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ to: '/app', label: '홈', icon: LayoutDashboard, end: true }] },
  {
    label: '양성',
    items: [
      { to: '/app/residents', label: '간사', icon: Home },
      { to: '/app/members', label: '교인', icon: Users },
      { to: '/app/pipeline', label: '파이프라인', icon: SquareKanban },
      { to: '/app/training', label: '훈련', icon: GraduationCap },
      { to: '/app/missionaries', label: '선교사', icon: Globe2 },
    ],
  },
  {
    label: '사역',
    items: [
      { to: '/app/attendance', label: '출석', icon: CalendarCheck },
      { to: '/app/calendar', label: '달력', icon: CalendarDays },
      { to: '/app/gallery', label: '갤러리', icon: Images },
      { to: '/app/organization-chart', label: '조직도', icon: Network },
    ],
  },
  { label: '운영', items: [{ to: '/app/finance', label: '재정', icon: Wallet }] },
];

/** 간사로 연결된 계정에만 보이는 개인 메뉴 — 노션 사이드바 맨 위의 내 공간처럼. */
const MY_FLOCK: NavItem = { to: '/app/my-flock', label: '내가 맡은 사람', icon: HeartHandshake };

/** 계정이 간사와 연결돼 있으면(팀 화면) 홈 바로 아래에 "내가 맡은 사람"을 끼운다. */
function useNavGroups(): NavGroup[] {
  const { state } = useAuth();
  const isShepherd = state.status === 'authenticated' && Boolean(state.self?.residentId);
  if (!isShepherd) return NAV_GROUPS;
  const [home, ...rest] = NAV_GROUPS;
  return [{ ...home, items: [...home.items, MY_FLOCK] }, ...rest];
}

export function AppLayout() {
  return (
    <ChurchBrandingProvider>
      <Shell />
    </ChurchBrandingProvider>
  );
}

function Shell() {
  const location = useLocation();
  // 빠른 이동(⌘K)은 하나만 — 데스크톱 상단 검색창과 폰 헤더 버튼이 같은 창을 연다
  const [paletteOpen, setPaletteOpen] = useState(false);
  const groups = useNavGroups();

  return (
    <div className="flex min-h-svh bg-[var(--color-canvas)]">
      <DesktopSidebar />

      {/*
       * flex 셸의 핵심 — 사이드바는 캔버스에 그냥 얹혀 있고, 본문만 흰 판으로 떠 있다.
       * (flex 토큰 --shadows-pageRoot 가 딱 이 판을 위한 것이다)
       * overflow-hidden 은 쓰지 않는다 — 상단바 sticky 가 죽는다. 대신 상단바가 자기 모서리를 갖는다.
       */}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-background)] md:my-2 md:mr-2 md:rounded-xl md:shadow-[var(--shadow-panel)]">
        <TopBar onSearch={() => setPaletteOpen(true)} />
        <MobileHeader onSearch={() => setPaletteOpen(true)} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navItems={groups.flatMap(group => group.items)} />

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 px-4 pt-5 pb-24 sm:px-7 sm:pt-6 md:pb-10"
        >
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </motion.main>

        <MobileTabBar />
      </div>
    </div>
  );
}

function DesktopSidebar() {
  const branding = useChurchBranding();
  const location = useLocation();
  const navGroups = useNavGroups();

  return (
    <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col px-3 py-3 md:flex">
      <div className="flex h-14 items-center gap-2.5 px-2">
        <ChurchLogo size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold tracking-tight">{branding.name}</div>
        </div>
      </div>

      <nav className="mt-1 flex flex-col gap-4 overflow-y-auto">
        {navGroups.map((group, index) => (
          <div key={group.label ?? `group-${index}`} className="flex flex-col gap-0.5">
            {group.label && <div className="px-2.5 pb-1 text-[11px] font-semibold text-[var(--color-muted-foreground)]">{group.label}</div>}
            {group.items.map(item => (
              <SidebarLink key={item.to} item={item} active={isActive(item, location.pathname)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <SidebarLink item={{ to: '/app/settings', label: '설정', icon: Settings }} active={location.pathname.startsWith('/app/settings')} />
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        // 사이드바 바닥이 캔버스(#f4f4f5)라서 활성 표시를 회색으로 하면 안 보인다 —
        // flex 처럼 흰 알약에 헤어라인을 둘러 띄운다.
        'relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-base font-semibold transition-colors',
        active ? 'text-[var(--color-foreground)]' : 'font-medium text-[var(--color-secondary-foreground)] hover:bg-[var(--color-accent)]'
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-md bg-[var(--color-background)] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.04)]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={cn('relative size-[18px]', active ? 'text-[var(--color-brand-hover)]' : 'text-[var(--color-muted-foreground)]')} />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

/**
 * 상단바 — flex 의 그 줄. 전역 검색 / 도움말 / 알림 / 프로필.
 * 검색은 아직 백엔드 전역 검색이 없어 교인 검색으로 보낸다(있는 것만 연결).
 */
function TopBar({ onSearch }: { onSearch: () => void }) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  // flex 의 toolbox — 높이 56px(--sizes-xlarge)에 고정
  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center gap-3 rounded-t-xl border-b border-[var(--color-border)] bg-[var(--color-background)]/90 px-5 backdrop-blur md:flex">
      {/* 노션처럼 검색창 = 빠른 이동(⌘K). 교인뿐 아니라 메뉴·간사·선교사·훈련 기수까지 찾는다 */}
      <button
        type="button"
        onClick={onSearch}
        className="relative flex h-8 max-w-sm flex-1 items-center rounded-md bg-[var(--color-muted)] pr-2 pl-8 text-left text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <span className="flex-1">검색하거나 이동하기</span>
        <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-background)] px-1.5 text-[11px]">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/app/settings"
          className="inline-flex size-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label="도움말·설정"
          title="설정"
        >
          <HelpCircle className="size-[18px]" />
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}

/** 프로필 메뉴 — 계정/역할, 소속 교회 전환, 설정, 로그아웃. */
function ProfileMenu() {
  const { state, logout, selectChurch } = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (state.status !== 'authenticated') return null;
  const { account, memberships, currentChurch, role } = state;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-[var(--color-muted)]"
        aria-label="프로필 메뉴"
      >
        <Avatar name={account.name} src={account.pictureUrl} size="sm" />
        <ChevronDown className="size-3.5 text-[var(--color-muted-foreground)]" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-md">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <Avatar name={account.name} src={account.pictureUrl} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{account.name}</div>
              <div className="truncate text-xs text-[var(--color-muted-foreground)]">{account.email}</div>
              {role && <div className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{ROLE_LABEL[role]}</div>}
            </div>
          </div>

          {memberships.length > 1 && (
            <div className="border-b border-[var(--color-border)] py-1.5">
              <div className="px-4 pb-1 text-[11px] font-semibold text-[var(--color-muted-foreground)]">소속 교회</div>
              {memberships.map(membership => (
                <button
                  key={membership.id}
                  onClick={() => void selectChurch(membership.churchId)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-muted)]',
                    membership.churchId === currentChurch?.id && 'font-semibold'
                  )}
                >
                  <span className="truncate">{membership.churchName ?? `교회 ${membership.churchId}`}</span>
                  {membership.churchId === currentChurch?.id && (
                    <span className="ml-2 size-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="py-1.5">
            <Link
              to="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-[var(--color-muted)]"
            >
              <Settings className="size-4 text-[var(--color-muted-foreground)]" />
              설정
            </Link>
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--color-muted)]"
            >
              <LogOut className="size-4 text-[var(--color-muted-foreground)]" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: '소유자',
  admin: '관리자',
  staff: '사역자',
  viewer: '조회 전용',
};

function MobileHeader({ onSearch }: { onSearch: () => void }) {
  const branding = useChurchBranding();
  const { state } = useAuth();
  const account = state.status === 'authenticated' ? state.account : null;

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 px-4 py-3 backdrop-blur md:hidden">
      <ChurchLogo size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{branding.name}</div>
      </div>
      {/* 폰에는 단축키가 없어서 버튼으로 빠른 이동을 연다 */}
      <Button variant="ghost" size="icon" onClick={onSearch} aria-label="검색·빠른 이동" title="검색·빠른 이동">
        <Search className="size-5" />
      </Button>
      <Link to="/app/settings" aria-label="설정">
        {account ? (
          <Avatar name={account.name} src={account.pictureUrl} size="sm" />
        ) : (
          <Button variant="ghost" size="icon">
            <Settings className="size-4" />
          </Button>
        )}
      </Link>
    </header>
  );
}

function MobileTabBar() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = useNavGroups();
  // 하단 탭은 4개 + 더보기. 나머지 메뉴(출석·달력·재정·설정 …)는 더보기 시트에서 — 예전에는 5개만 두고 나머지로 갈 길이 없었다
  const tabs = groups.flatMap(group => group.items).slice(0, 4);
  const inTabs = tabs.some(item => isActive(item, location.pathname));

  return (
    <>
      <nav className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-[var(--color-border)] bg-[var(--color-background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map(item => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'
              )}
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
            !inTabs ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'
          )}
        >
          <Menu className="size-5" />
          더보기
        </button>
      </nav>
      {moreOpen && <MoreSheet groups={groups} onClose={() => setMoreOpen(false)} />}
    </>
  );
}

/** 모바일 전체 메뉴 — 아래에서 올라오는 시트. 노션 모바일의 사이드바처럼 데스크탑 사이드바와 같은 묶음을 그대로 보여준다. */
function MoreSheet({ groups, onClose }: { groups: NavGroup[]; onClose: () => void }) {
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 md:hidden" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="max-h-[80svh] w-full overflow-y-auto rounded-t-2xl bg-[var(--color-background)] px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--color-border)]" />
        <nav className="flex flex-col gap-3">
          {groups.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="flex flex-col gap-0.5">
              {group.label && (
                <div className="px-2.5 pb-1 text-[11px] font-semibold text-[var(--color-muted-foreground)]">{group.label}</div>
              )}
              {group.items.map(item => (
                <div key={item.to} onClick={onClose}>
                  <SidebarLink item={item} active={isActive(item, location.pathname)} />
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-[var(--color-border)] pt-2" onClick={onClose}>
            <SidebarLink
              item={{ to: '/app/settings', label: '설정', icon: Settings }}
              active={location.pathname.startsWith('/app/settings')}
            />
          </div>
        </nav>
      </motion.div>
    </div>
  );
}

function isActive(item: NavItem, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}
