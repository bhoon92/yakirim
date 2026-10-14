import { Building2, ChevronRight, Users2 } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

type SettingSection = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  hint: string;
  to?: string;
};

const SECTIONS: SettingSection[] = [
  {
    icon: Building2,
    title: '교회 정보',
    description: '교회명, 사업자등록번호, 대표자, 주소, 로고 등',
    hint: '영수증 발급 주체',
  },
  {
    icon: Users2,
    title: '팀원 / 권한',
    description: '이메일로 팀원을 초대하고 역할(소유자/관리자/실무자/간사/조회)을 부여하고, 계정을 교인과 연결합니다.',
    hint: 'OWNER·ADMIN 전용',
    to: '/app/settings/team',
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="설정" title="교회 설정" description="우리 교회만의 운영 규칙과 데이터를 관리합니다." />

      <div className="grid gap-3">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const card = (
            <Card className="transition-colors hover:bg-[var(--color-muted)]/60">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <span className="text-xs text-[var(--color-muted-foreground)]">· {section.hint}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{section.description}</p>
                </div>
                <ChevronRight className="size-4 text-[var(--color-muted-foreground)]" />
              </CardContent>
            </Card>
          );
          return section.to ? (
            <Link key={section.title} to={section.to} className="block">
              {card}
            </Link>
          ) : (
            <div key={section.title}>{card}</div>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-1.5 p-5 text-sm text-[var(--color-muted-foreground)]">
          <p className="font-medium text-[var(--color-foreground)]">나머지 설정은 각 메뉴에서 바로 관리해요</p>
          <p>· 기관·사역팀·공동체 → 조직도(트리에서 바로 추가·수정) · 재적상태·사역 역할 → 교인 · 예배 → 출석 · 훈련 과정 → 훈련</p>
          <p>· 헌금 분류·계정과목·회계연도 → 재정 · 달력 연동(Google) → 달력</p>
        </CardContent>
      </Card>
    </div>
  );
}
