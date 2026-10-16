import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, Eye, EyeOff, Plus, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { listReferences } from '@/api/references';
import {
  TRAINING_FORMAT_LABEL,
  byLadder,
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
  type CoursePatch,
  type TrainingCourse,
  type TrainingFormat,
} from '@/api/training';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSubmitEnter } from '@/lib/keyboard';

const FORMATS: TrainingFormat[] = ['weekly', 'retreat', 'intensive', 'etc'];

function useCourses() {
  return useQuery({ queryKey: ['training', 'courses'], queryFn: listCourses });
}

function StepBadge({ step }: { step: number | null }) {
  if (step === null) return null;
  return (
    <span className="shrink-0 rounded bg-[var(--color-foreground)] px-1.5 py-px text-[10px] font-semibold text-[var(--color-background)] tabular-nums">
      STEP {step}
    </span>
  );
}

/**
 * 과정 선택 칸 — 노션 선택 속성처럼 쓴다 (planning 00.7).
 * 이름을 적고 Enter 를 누르면 없던 과정은 그 자리에서 만들어 고르고, 옆의 설정 아이콘으로
 * STEP·수료 시 단계·형식·회차를 같은 칸 안에서 고친다. 훈련은 수시로 생기고 사라지기 때문이다.
 */
export function CoursePicker({ value, onChange }: { value: number | null; onChange: (courseId: number | null) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: courses = [] } = useCourses();
  const selected = courses.find(course => course.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const createMut = useMutation({
    mutationFn: (name: string) => createCourse({ name }),
    onSuccess: course => {
      queryClient.invalidateQueries({ queryKey: ['training', 'courses'] });
      onChange(course.id);
      setQuery('');
      setOpen(false);
    },
    onError: (error: Error) => window.alert(`과정 만들기 실패: ${error.message}`),
  });

  const keyword = query.trim();
  const sorted = [...courses].sort(byLadder);
  const visible = sorted.filter(course => course.isActive && (!keyword || course.name.includes(keyword)));
  const hidden = sorted.filter(course => !course.isActive && (!keyword || course.name.includes(keyword)));
  const exact = courses.find(course => course.name === keyword);

  const pick = (course: TrainingCourse) => {
    onChange(course.id);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (isSubmitEnter(event) && keyword && !createMut.isPending) {
      event.preventDefault();
      if (exact?.isActive) pick(exact);
      else if (!exact) createMut.mutate(keyword);
    }
  };

  const editing = editingId !== null ? courses.find(course => course.id === editingId) : undefined;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setEditingId(null);
        }}
        className="flex w-72 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-left text-sm"
      >
        {selected ? (
          <>
            <StepBadge step={selected.step} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-[var(--color-muted-foreground)]">과정 선택 또는 새로 만들기</span>
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-[var(--color-muted-foreground)]" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1.5 shadow-md">
          {editing ? (
            <>
              <button
                onClick={() => setEditingId(null)}
                className="mb-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              >
                <ChevronLeft className="size-3.5" />
                과정 목록
              </button>
              <CourseOptionEditor
                course={editing}
                courses={courses}
                onDeleted={() => {
                  setEditingId(null);
                  if (value === editing.id) onChange(null);
                }}
              />
            </>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="과정 검색 또는 새로 만들기"
                className="w-full rounded-md bg-[var(--color-muted)] px-2.5 py-1.5 text-sm outline-none"
              />
              <ul className="mt-1 max-h-72 overflow-y-auto">
                {visible.map(course => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    selected={course.id === value}
                    onPick={() => pick(course)}
                    onEdit={() => setEditingId(course.id)}
                  />
                ))}
                {keyword && !exact && (
                  <li>
                    <button
                      disabled={createMut.isPending}
                      onClick={() => createMut.mutate(keyword)}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]"
                    >
                      <Plus className="size-3.5 shrink-0" />
                      <span className="truncate">
                        “<strong>{keyword}</strong>” 과정 만들기
                      </span>
                    </button>
                  </li>
                )}
                {hidden.length > 0 && (
                  <li className="mt-1 border-t border-[var(--color-border)] pt-1">
                    <button
                      onClick={() => setShowHidden(!showHidden)}
                      className="w-full rounded-md px-1.5 py-1 text-left text-[11px] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                    >
                      숨긴 과정 {hidden.length}개 {showHidden ? '접기' : '보기'}
                    </button>
                  </li>
                )}
                {showHidden &&
                  hidden.map(course => (
                    <CourseRow key={course.id} course={course} selected={false} onEdit={() => setEditingId(course.id)} />
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CourseRow({
  course,
  selected,
  onPick,
  onEdit,
}: {
  course: TrainingCourse;
  selected: boolean;
  /** 없으면 고를 수 없는 행(숨긴 과정) — 설정만 연다. */
  onPick?: () => void;
  onEdit: () => void;
}) {
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-[var(--color-muted)]',
        selected && 'bg-[var(--color-muted)]',
        !course.isActive && 'opacity-60'
      )}
    >
      <button onClick={onPick ?? onEdit} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left text-sm">
        <StepBadge step={course.step} />
        <span className="truncate">{course.name}</span>
        <span className="shrink-0 text-[11px] text-[var(--color-muted-foreground)]">{TRAINING_FORMAT_LABEL[course.format]}</span>
      </button>
      <button
        onClick={onEdit}
        className="rounded p-1 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5"
        aria-label={`${course.name} 설정`}
        title="STEP·수료 시 단계·형식"
      >
        <Settings2 className="size-3.5" />
      </button>
    </li>
  );
}

/**
 * 과정 속성 편집 — 바꾸는 즉시 저장한다 (노션 속성처럼 저장 버튼이 없다).
 * 드롭다운 안과 "과정 관리" 창이 같은 편집기를 쓴다.
 */
export function CourseOptionEditor({
  course,
  courses,
  onDeleted,
}: {
  course: TrainingCourse;
  courses: TrainingCourse[];
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(course.name);
  const [sessions, setSessions] = useState(String(course.defaultSessionCount));

  const { data: statuses = [] } = useQuery({ queryKey: ['references', 'memberStatus'], queryFn: () => listReferences('memberStatus') });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training', 'courses'] });
    queryClient.invalidateQueries({ queryKey: ['training', 'cohorts'] });
    // 간사 화면 STEP 칸이 이 값을 본다
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  };

  const patchMut = useMutation({
    mutationFn: (payload: CoursePatch) => updateCourse(course.id, payload),
    onSuccess: invalidate,
    onError: (error: Error) => {
      setName(course.name);
      window.alert(`저장 실패: ${error.message}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => {
      invalidate();
      onDeleted?.();
    },
    onError: (error: Error) => window.alert(`삭제 실패: ${error.message}`),
  });

  const saveName = () => {
    const next = name.trim();
    if (!next) setName(course.name);
    else if (next !== course.name) patchMut.mutate({ name: next });
  };

  const saveSessions = () => {
    const next = Number(sessions);
    if (!Number.isInteger(next) || next < 1) setSessions(String(course.defaultSessionCount));
    else if (next !== course.defaultSessionCount) patchMut.mutate({ defaultSessionCount: next });
  };

  // STEP 은 지금 쓰는 번호 + 다음 번호 하나까지 고를 수 있다. 같은 번호를 두 과정이 가지면 표시해준다.
  const usedSteps = courses.filter(other => other.step !== null && other.id !== course.id);
  const maxStep = Math.max(0, ...courses.map(other => other.step ?? 0));
  const stepOptions = Array.from({ length: Math.max(maxStep + 1, course.step ?? 0) }, (_, index) => index + 1);
  const holder = (step: number) => usedSteps.find(other => other.step === step)?.name;

  const activeStatuses = statuses.filter(status => status.isActive || status.id === course.completionStatusId);

  return (
    <div className="space-y-3 p-1.5 text-sm">
      <Field label="이름">
        <Input
          value={name}
          onChange={event => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={event => isSubmitEnter(event) && (event.currentTarget as HTMLInputElement).blur()}
        />
      </Field>

      <Field label="훈련 사다리" hint="STEP 번호가 있는 과정만 간사 화면 STEP 칸에 나옵니다.">
        <select
          value={course.step ?? ''}
          onChange={event => patchMut.mutate({ step: event.target.value === '' ? null : Number(event.target.value) })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5"
        >
          <option value="">사다리 밖 (일회성 훈련)</option>
          {stepOptions.map(step => (
            <option key={step} value={step}>
              STEP {step}
              {holder(step) ? ` — ${holder(step)}와 겹침` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="수료하면" hint="수료 처리할 때 제안만 합니다. 자동으로 바뀌지 않습니다.">
        <select
          value={course.completionStatusId ?? ''}
          onChange={event => patchMut.mutate({ completionStatusId: event.target.value === '' ? null : Number(event.target.value) })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5"
        >
          <option value="">재적상태 제안 안 함</option>
          {activeStatuses.map(status => (
            <option key={status.id} value={status.id}>
              “{status.name}”(으)로 올리기 제안
            </option>
          ))}
        </select>
      </Field>

      <Field label="형식 · 기본 회차">
        <div className="flex flex-wrap items-center gap-1">
          {FORMATS.map(format => (
            <button
              key={format}
              onClick={() => format !== course.format && patchMut.mutate({ format })}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                course.format === format
                  ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
              )}
            >
              {TRAINING_FORMAT_LABEL[format]}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={sessions}
            onChange={event => setSessions(event.target.value)}
            onBlur={saveSessions}
            className="w-20"
            aria-label="기본 회차 수"
          />
          <span className="text-xs text-[var(--color-muted-foreground)]">회차 (기수를 열 때 기본값)</span>
        </div>
      </Field>

      <div className="flex items-center gap-1 border-t border-[var(--color-border)] pt-2">
        <button
          onClick={() => patchMut.mutate({ isActive: !course.isActive })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
        >
          {course.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {course.isActive ? '숨기기' : '숨김 해제'}
        </button>
        <button
          onClick={() => {
            if (course.cohortCount > 0) {
              window.alert(
                `기수 ${course.cohortCount}개가 이 과정으로 열려 있어 지울 수 없습니다 — 지우면 수료 이력이 끊깁니다.\n더 쓰지 않는다면 "숨기기"를 쓰세요.`
              );
              return;
            }
            if (window.confirm(`"${course.name}" 과정을 삭제할까요?`)) deleteMut.mutate();
          }}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
        >
          <Trash2 className="size-3.5" />
          삭제
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  );
}
