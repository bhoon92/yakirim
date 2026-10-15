import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Settings2, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { listMembers, type Member } from '@/api/members';
import {
  addNote,
  createMissionary,
  deleteNote,
  fetchMissionaryDetail,
  fetchMissionarySummary,
  listMissionaries,
  listStages,
  removeMissionary,
  updateMissionary,
  type Missionary,
  type MissionaryStage,
} from '@/api/missionary';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { todayString } from '@/lib/date';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { MissionaryStageManagerModal } from './missionary-stage-manager';

export function MissionariesPage() {
  const { can } = usePermissions();
  const canWrite = can('missionary:write');
  const [filter, setFilter] = useState<{ kind: 'active' | 'all' | 'stage'; stageId?: number }>({ kind: 'active' });
  const [openId, setOpenId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [managingStages, setManagingStages] = useState(false);

  const { data: stages = [] } = useQuery({ queryKey: ['missionary', 'stages'], queryFn: listStages });
  const { data: summary } = useQuery({ queryKey: ['missionaries', 'summary'], queryFn: fetchMissionarySummary });
  const { data: missionaries = [], isLoading } = useQuery({
    queryKey: ['missionaries', filter],
    queryFn: () =>
      listMissionaries(filter.kind === 'stage' ? { stageId: filter.stageId } : { scope: filter.kind === 'active' ? 'active' : 'all' }),
  });

  const countFor = (stageId: number) => summary?.byStage.find(row => row.stageId === stageId)?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="양성"
        title="선교사"
        description="파송 단계와 경과를 관리합니다. 단계 구성은 교회에 맞게 바꿀 수 있습니다."
        actions={
          canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => setManagingStages(true)}>
                <Settings2 className="size-4" />
                단계 관리
              </Button>
              <PanelToggle open={registering} onToggle={() => setRegistering(!registering)} label="선교사 등록" variant="default" />
            </>
          )
        }
      />

      {managingStages && <MissionaryStageManagerModal onClose={() => setManagingStages(false)} />}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="현재 파송" value={summary ? `${summary.active}명` : '—'} />
        <StatTile label="올해 파송 확정" value={summary ? `${summary.commissionedThisYear}명` : '—'} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter.kind === 'active'} onClick={() => setFilter({ kind: 'active' })}>
          파송 중
        </FilterChip>
        <FilterChip active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
          전체
        </FilterChip>
        {stages
          .filter(stage => stage.isActive)
          .map(stage => (
            <FilterChip
              key={stage.id}
              active={filter.kind === 'stage' && filter.stageId === stage.id}
              onClick={() => setFilter({ kind: 'stage', stageId: stage.id })}
            >
              {stage.name} {countFor(stage.id)}
            </FilterChip>
          ))}
      </div>

      {registering && <RegisterPanel stages={stages} onClose={() => setRegistering(false)} />}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : missionaries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Globe2 className="size-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {filter.kind === 'active' ? '현재 파송 중인 선교사가 없습니다.' : '해당 조건의 선교사가 없습니다.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {missionaries.map(missionary => (
            <button key={missionary.id} onClick={() => setOpenId(missionary.id)} className="text-left">
              <Card className="h-full transition-colors hover:border-[var(--color-foreground)]">
                <CardContent className="space-y-1.5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={missionary.memberName} size="sm" />
                      <p className="truncate font-semibold">{missionary.memberName}</p>
                    </div>
                    {missionary.stageName ? (
                      <Badge tone={missionary.stageCountsAsActive ? 'success' : 'neutral'}>{missionary.stageName}</Badge>
                    ) : (
                      <Badge tone="muted">단계 미지정</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {[missionary.country, missionary.region].filter(Boolean).join(' ') || '파송지 미정'}
                  </p>
                  {missionary.fieldWork && <p className="truncate text-sm">{missionary.fieldWork}</p>}
                  {missionary.commissionedAt && (
                    <p className="text-xs tabular-nums text-[var(--color-muted-foreground)]">파송 {missionary.commissionedAt}</p>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {openId !== null && <MissionaryDetailModal id={openId} stages={stages} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
          : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
      )}
    >
      {children}
    </button>
  );
}

/**
 * 등록 패널 — 명부에 없는 사람도 여기서 바로 등록한다.
 * 교인 화면을 먼저 다녀와야 했던 흐름을 없애기 위해 "새로 등록" 탭을 둔다.
 */
function RegisterPanel({ stages, onClose }: { stages: MissionaryStage[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stageId, setStageId] = useState<number | ''>('');
  const [country, setCountry] = useState('');

  const { data } = useQuery({
    queryKey: ['members', 'for-missionary', query],
    queryFn: () => listMembers({ q: query || undefined, pageSize: 20 }),
    enabled: mode === 'existing',
    // 한 글자마다 queryKey 가 바뀌어 목록이 비었다 차는 깜빡임을 막는다
    placeholderData: keepPreviousData,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createMissionary({
        ...(mode === 'existing' ? { memberId: picked!.id } : { newMember: { name: name.trim(), phone: phone.trim() || undefined } }),
        stageId: stageId === '' ? undefined : stageId,
        country: country.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missionaries'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      onClose();
    },
    onError: (error: Error) => window.alert(`등록 실패: ${error.message}`),
  });

  const ready = mode === 'existing' ? Boolean(picked) : Boolean(name.trim());

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex gap-1.5">
          <FilterChip active={mode === 'new'} onClick={() => setMode('new')}>
            새로 등록
          </FilterChip>
          <FilterChip active={mode === 'existing'} onClick={() => setMode('existing')}>
            기존 교인에서 선택
          </FilterChip>
        </div>

        {mode === 'new' ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="이름" value={name} onChange={event => setName(event.target.value)} className="w-40" />
              <Input placeholder="연락처 (선택)" value={phone} onChange={event => setPhone(event.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-[var(--color-muted-foreground)]">교인 명부에도 함께 등록됩니다.</p>
          </>
        ) : (
          <>
            <Input placeholder="교인 이름으로 검색" value={query} onChange={event => setQuery(event.target.value)} />
            {/* 훈련 수강생 추가와 같은 이유로 높이를 고정한다 — 결과 수에 따라 아래 목록이 밀리면
                스크롤 위치가 튀면서 검색창까지 흔들린다. */}
            <div className="h-[112px] overflow-y-auto rounded-md bg-[var(--color-muted)] p-2">
              {(data?.items ?? []).length === 0 ? (
                <p className="py-2 text-center text-xs text-[var(--color-muted-foreground)]">
                  {query ? '검색 결과가 없습니다.' : '등록할 교인을 검색하세요.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(data?.items ?? []).map(member => (
                    <FilterChip key={member.id} active={picked?.id === member.id} onClick={() => setPicked(member)}>
                      {member.name}
                    </FilterChip>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stageId}
            onChange={event => setStageId(event.target.value === '' ? '' : Number(event.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm"
          >
            <option value="">단계 미지정</option>
            {stages
              .filter(stage => stage.isActive)
              .map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
          </select>
          <Input placeholder="파송 국가 (선택)" value={country} onChange={event => setCountry(event.target.value)} className="w-40" />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={() => createMut.mutate()} disabled={!ready || createMut.isPending}>
            등록
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MissionaryDetailModal({ id, stages, onClose }: { id: number; stages: MissionaryStage[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('missionary:write');

  const { data: missionary, isLoading } = useQuery({
    queryKey: ['missionary', id],
    queryFn: () => fetchMissionaryDetail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['missionary', id] });
    queryClient.invalidateQueries({ queryKey: ['missionaries'] });
    queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
  };

  const stageMut = useMutation({
    mutationFn: (nextStageId: number) => updateMissionary(id, { stageId: nextStageId }),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`단계 변경 실패: ${error.message}`),
  });

  const fieldMut = useMutation({
    mutationFn: (payload: { country?: string; region?: string; fieldWork?: string }) => updateMissionary(id, payload),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`저장 실패: ${error.message}`),
  });

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: number) => deleteNote(id, noteId),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`삭제 실패: ${error.message}`),
  });

  const removeMut = useMutation({
    mutationFn: () => removeMissionary(id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error: Error) => window.alert(`제거 실패: ${error.message}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{missionary?.memberName ?? '불러오는 중…'}</h2>
            {missionary && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {missionary.stageName ?? '단계 미지정'}
                {missionary.stageCountsAsActive ? ' · 출석 명단 제외' : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canWrite && missionary && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="파송 트랙에서 제거"
                title="파송 트랙에서 제거"
                disabled={removeMut.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `${missionary.memberName} 님을 파송 트랙에서 제거할까요?\n선교사 기록도 함께 삭제됩니다. 교인 명부에는 그대로 남습니다.`
                    )
                  ) {
                    removeMut.mutate();
                  }
                }}
              >
                <Trash2 className="text-[var(--color-destructive)]" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
              <X />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-6 py-5">
          {isLoading || !missionary ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
          ) : (
            <>
              {/* 현재 상태 = 드롭다운으로 직접 관리. 사유를 남기려면 아래 기록 폼을 쓴다. */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">현재 단계</h3>
                {canWrite ? (
                  <select
                    value={missionary.stageId ?? ''}
                    onChange={event => event.target.value !== '' && stageMut.mutate(Number(event.target.value))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                  >
                    <option value="">단계 미지정</option>
                    {stages
                      .filter(stage => stage.isActive || stage.id === missionary.stageId)
                      .map(stage => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-sm">{missionary.stageName ?? '단계 미지정'}</p>
                )}
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  여기서 바꾸면 기록이 남지 않습니다. 사유를 남기려면 아래 “기록 추가”에서 단계를 함께 선택하세요.
                </p>
              </div>

              <FieldEditor missionary={missionary} canWrite={canWrite} onSave={payload => fieldMut.mutate(payload)} />

              <div className="border-t border-[var(--color-border)] pt-4">
                <h3 className="mb-2 text-sm font-semibold">기록</h3>
                {canWrite && <NoteForm missionaryId={id} stages={stages} onDone={invalidate} />}

                {missionary.notes.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">기록 없음</p>
                ) : (
                  <ul className="space-y-2">
                    {missionary.notes.map(note => (
                      <li key={note.id} className="rounded-xl border border-[var(--color-border)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {note.stageName && <Badge tone="accent">{note.stageName}</Badge>}
                            <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{note.date}</span>
                          </div>
                          {canWrite && (
                            <button
                              onClick={() => {
                                if (window.confirm('이 기록을 삭제할까요?')) deleteNoteMut.mutate(note.id);
                              }}
                              className="rounded-full p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                              aria-label="기록 삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.content}</p>
                        {note.recorderName && <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">{note.recorderName}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 기록 폼 — 메모가 본체, 단계는 옆의 드롭다운에서 선택하거나 비워둔다. */
function NoteForm({ missionaryId, stages, onDone }: { missionaryId: number; stages: MissionaryStage[]; onDone: () => void }) {
  const [content, setContent] = useState('');
  const [stageId, setStageId] = useState<number | ''>('');
  const [date, setDate] = useState(todayString());

  const addMut = useMutation({
    mutationFn: () =>
      addNote(missionaryId, {
        content: content.trim(),
        stageId: stageId === '' ? undefined : stageId,
        date,
      }),
    onSuccess: () => {
      setContent('');
      setStageId('');
      onDone();
    },
    onError: (error: Error) => window.alert(`기록 실패: ${error.message}`),
  });

  return (
    <div className="mb-3 space-y-2 rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <textarea
        placeholder="경과 메모 (예: 비자 발급 완료, 파송예배 일정 확정)"
        value={content}
        onChange={event => setContent(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={stageId}
          onChange={event => setStageId(event.target.value === '' ? '' : Number(event.target.value))}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm"
        >
          <option value="">단계 변화 없음</option>
          {stages
            .filter(stage => stage.isActive)
            .map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}(으)로 이동
              </option>
            ))}
        </select>
        <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-40" />
        <Button size="sm" onClick={() => addMut.mutate()} disabled={!content.trim() || addMut.isPending}>
          기록 추가
        </Button>
      </div>
    </div>
  );
}

function FieldEditor({
  missionary,
  canWrite,
  onSave,
}: {
  missionary: Missionary;
  canWrite: boolean;
  onSave: (payload: { country?: string; region?: string; fieldWork?: string }) => void;
}) {
  const [country, setCountry] = useState(missionary.country ?? '');
  const [region, setRegion] = useState(missionary.region ?? '');
  const [fieldWork, setFieldWork] = useState(missionary.fieldWork ?? '');

  const dirty =
    country !== (missionary.country ?? '') || region !== (missionary.region ?? '') || fieldWork !== (missionary.fieldWork ?? '');

  if (!canWrite) {
    return (
      <div className="space-y-1 text-sm">
        <p>{[missionary.country, missionary.region].filter(Boolean).join(' ') || '파송지 미정'}</p>
        {missionary.fieldWork && <p className="text-[var(--color-muted-foreground)]">{missionary.fieldWork}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">파송지</h3>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="국가" value={country} onChange={event => setCountry(event.target.value)} className="w-32" />
        <Input placeholder="지역/도시" value={region} onChange={event => setRegion(event.target.value)} className="w-40" />
      </div>
      <Input placeholder="사역 내용" value={fieldWork} onChange={event => setFieldWork(event.target.value)} />
      {dirty && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() =>
              onSave({
                country: country.trim() || undefined,
                region: region.trim() || undefined,
                fieldWork: fieldWork.trim() || undefined,
              })
            }
          >
            저장
          </Button>
        </div>
      )}
    </div>
  );
}
