import { Plus, X } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';

import { Button } from '@/components/ui/button';

type PanelToggleProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'children'> & {
  open: boolean;
  onToggle: () => void;
  /** 닫혀 있을 때 보여줄 라벨 (예: "수강생 추가") */
  label: string;
  /** 열려 있을 때 보여줄 라벨. 기본은 "닫기" */
  closeLabel?: string;
  /** 닫혀 있을 때의 아이콘. 기본은 + */
  icon?: ComponentType<{ className?: string }>;
};

/**
 * 인라인 패널을 여닫는 버튼.
 *
 * 패널을 열어도 이 버튼이 화면에 그대로 남는 자리에서는, 라벨이 계속 "추가"면
 * 다시 눌러도 아무 일이 없는 것처럼 보인다(실제로 `setX(true)` 만 하던 곳이 여럿이었다).
 * 열린 동안에는 "닫기"로 바꿔서 이 버튼이 방금 연 패널의 짝이라는 걸 드러낸다.
 *
 * 패널이 열릴 때 버튼 자체가 사라지는 자리(course-manager·missionary-stage-manager)나
 * 오버레이가 버튼을 덮는 모달에는 쓰지 않는다 — 거기선 이미 혼동이 없다.
 */
export function PanelToggle({
  open,
  onToggle,
  label,
  closeLabel = '닫기',
  icon: Icon = Plus,
  size = 'sm',
  variant = 'ghost',
  ...props
}: PanelToggleProps) {
  return (
    <Button size={size} variant={variant} onClick={onToggle} aria-expanded={open} {...props}>
      {open ? <X className="size-3.5" /> : <Icon className="size-3.5" />}
      {open ? closeLabel : label}
    </Button>
  );
}
