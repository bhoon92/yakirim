import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { TRAINING_FORMAT_LABEL, byLadder, createCourse, listCourses } from '@/api/training';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { CourseOptionEditor } from './course-picker';

/**
 * 훈련 과정 전체 보기 — 기수 개설 칸의 드롭다운과 같은 편집기를 쓴다.
 * 과정은 드롭다운에서 이름을 적는 순간 생기므로, 여기는 사다리 전체를 한눈에 보고 정리하는 곳이다.
 */
export function CourseManagerModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">훈련 과정</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <CourseList />
        </div>
      </div>
    </div>
  );
}

function CourseList() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('training:write');
  const [openId, setOpenId] = useState<number | null>(null);
  const [name, setName] = useState('');

  const { data: courses = [], isLoading } = useQuery({ queryKey: ['training', 'courses'], queryFn: listCourses });
  const sorted = [...courses].sort(byLadder);

  const createMut = useMutation({
    mutationFn: () => createCourse({ name: name.trim() }),
    onSuccess: course => {
      queryClient.invalidateQueries({ queryKey: ['training', 'courses'] });
      setName('');
      setOpenId(course.id);
    },
    onError: (error: Error) => window.alert(`과정 만들기 실패: ${error.message}`),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">
        STEP 번호가 있는 과정이 훈련 사다리입니다. 일회성 훈련은 “사다리 밖”으로 두세요. 더 쓰지 않는 과정은 숨기면 기수 개설 목록에서
        빠지고 수료 이력은 그대로 남습니다.
      </p>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(course => {
            const open = openId === course.id;
            return (
              <li key={course.id} className={cn('rounded-xl border border-[var(--color-border)]', !course.isActive && 'opacity-60')}>
                <button
                  onClick={() => setOpenId(open ? null : course.id)}
                  disabled={!canWrite}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  {canWrite && (open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />)}
                  <span className="w-14 shrink-0 text-xs font-semibold tabular-nums">
                    {course.step !== null ? `STEP ${course.step}` : <span className="text-[var(--color-muted-foreground)]">—</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.name}</span>
                  <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                    {TRAINING_FORMAT_LABEL[course.format]} · {course.defaultSessionCount}회차 · 기수 {course.cohortCount}
                    {!course.isActive && ' · 숨김'}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-[var(--color-border)] p-2">
                    <CourseOptionEditor course={course} courses={courses} onDeleted={() => setOpenId(null)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <div className="flex gap-2">
          <Input
            placeholder="새 과정 이름 (예: 겨울 수련회)"
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && name.trim() && !createMut.isPending && createMut.mutate()}
          />
          <Button size="sm" variant="outline" onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
            <Plus className="size-3.5" />
            만들기
          </Button>
        </div>
      )}
    </div>
  );
}
