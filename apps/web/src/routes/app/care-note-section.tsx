import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

import {
  createCareNote,
  createCareNoteTemplate,
  deleteCareNote,
  deleteCareNoteTemplate,
  listCareNoteMentions,
  listCareNotes,
  listCareNoteTemplates,
  type CareNoteTemplate,
  type CreateCareNotePayload,
} from '@/api/care-notes';
import { listReferences } from '@/api/references';
import { Button } from '@/components/ui/button';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { TagChip, TagChipButton } from '@/components/ui/tag-chip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { todayString } from '@/lib/date';
import { isSubmitEnter } from '@/lib/keyboard';
import { mentionsInText } from '@/lib/autocomplete/use-member-mention';
import { MemberDetailModal } from './member-detail-modal';

/**
 * 본문의 "@이름" 을 눌러서 그 교인 카드를 여는 링크로 — 저장된 언급(mentions)에 있는 이름만.
 * 긴 이름부터 맞춰야 "@김성" 이 "@김성도" 를 먼저 먹지 않는다.
 */
function withMentions(text: string, mentions: { id: number; name: string }[], onOpen: (id: number) => void): ReactNode {
  if (mentions.length === 0) return text;
  const byName = new Map(mentions.map(mention => [`@${mention.name}`, mention.id]));
  const escaped = [...byName.keys()].sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.split(new RegExp(`(${escaped.join('|')})`)).map((part, index) => {
    const id = byName.get(part);
    return id ? (
      <button
        key={index}
        type="button"
        onClick={() => onOpen(id)}
        className="font-semibold text-[var(--color-primary,#2563eb)] hover:underline"
      >
        {part}
      </button>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    );
  });
}

/** 기록 종류는 교회가 편집하는 기준정보다. 색은 종류 id 로 정해져 상세·목록 어디서든 같다. */
function useCareNoteTypes() {
  return useQuery({ queryKey: ['references', 'careNoteType'], queryFn: () => listReferences('careNoteType') });
}

export function CareNoteSection({ memberId }: { memberId: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('care:write');
  const [adding, setAdding] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['care-notes', memberId],
    queryFn: () => listCareNotes(memberId),
  });
  // 노션의 백링크 — 다른 사람의 기록에서 이 사람을 @ 로 언급한 것
  const { data: mentionedIn = [] } = useQuery({
    queryKey: ['care-notes', 'mentions', memberId],
    queryFn: () => listCareNoteMentions(memberId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['care-notes'] }); // 언급된 사람의 백링크도 함께
    // "내가 맡은 사람"·간사 상세의 순서가 마지막 기록일로 정해진다
    queryClient.invalidateQueries({ queryKey: ['flock'] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCareNote(memberId, id),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">심방·양육 기록</h3>
        {canWrite && <PanelToggle open={adding} onToggle={() => setAdding(!adding)} label="기록" />}
      </div>

      {adding && (
        <NoteForm
          memberId={memberId}
          onDone={() => {
            invalidate();
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : notes.length === 0 && !adding ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">아직 기록이 없습니다. 심방·면담 내용을 남겨보세요.</p>
      ) : (
        <ul className="mt-1 space-y-3">
          {notes.map(note => (
            <li key={note.id} className="rounded-xl border border-[var(--color-border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TagChip name={note.typeName ?? '(삭제된 종류)'} seed={note.typeId} />
                  <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{note.date}</span>
                  {note.location && <span className="text-xs text-[var(--color-muted-foreground)]">· {note.location}</span>}
                </div>
                {canWrite && (
                  <button
                    onClick={() => {
                      if (window.confirm('이 기록을 삭제할까요?')) deleteMut.mutate(note.id);
                    }}
                    className="rounded-full p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                    aria-label="삭제"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm">{withMentions(note.content, note.mentions, setOpenMemberId)}</p>

              {note.prayerRequest && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--color-muted)] px-2.5 py-1.5 text-xs">
                  <span className="font-medium">기도제목 </span>
                  {note.prayerRequest}
                </p>
              )}
              {note.statusNote && (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-[var(--color-muted-foreground)]">
                  <span className="font-medium">상황 </span>
                  {note.statusNote}
                </p>
              )}

              <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">{note.recorderName ?? '작성자 미상'}</p>
            </li>
          ))}
        </ul>
      )}

      {mentionedIn.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-muted-foreground)]">
            다른 기록에서 언급됨 {mentionedIn.length}
          </summary>
          <ul className="mt-2 space-y-2">
            {mentionedIn.map(note => (
              <li key={note.id} className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                  <button type="button" onClick={() => setOpenMemberId(note.subjectMemberId)} className="font-semibold hover:underline">
                    {note.subjectName}
                  </button>
                  <span className="tabular-nums">{note.date}</span>
                  <span>· {note.typeName ?? '기록'}</span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{withMentions(note.content, note.mentions, setOpenMemberId)}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {openMemberId !== null && openMemberId !== memberId && (
        <MemberDetailModal memberId={openMemberId} onClose={() => setOpenMemberId(null)} />
      )}
    </div>
  );
}

function NoteForm({ memberId, onDone, onCancel }: { memberId: number; onDone: () => void; onCancel: () => void }) {
  const today = todayString();
  const { data: types = [] } = useCareNoteTypes();
  const selectable = types.filter(item => item.isActive);
  const [typeId, setTypeId] = useState<number | null>(null);
  // 첫 렌더에는 종류 목록이 아직 없다 — 도착하면 첫 항목을 기본값으로.
  const activeTypeId = typeId ?? selectable[0]?.id ?? null;
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');
  const [statusNote, setStatusNote] = useState('');
  // @ 로 고른 교인 — 저장할 때 본문에 아직 "@이름" 이 남은 사람만 보낸다
  const [picked, setPicked] = useState<Map<number, string>>(() => new Map());

  const createMut = useMutation({
    mutationFn: (payload: CreateCareNotePayload) => createCareNote(memberId, payload),
    onSuccess: onDone,
  });

  const submit = () => {
    if (!content.trim()) return;
    createMut.mutate({
      typeId: activeTypeId ?? undefined,
      date,
      location: location.trim() || undefined,
      content: content.trim(),
      prayerRequest: prayerRequest.trim() || undefined,
      statusNote: statusNote.trim() || undefined,
      mentionedMemberIds: mentionsInText(content, picked),
    });
  };

  const applyTemplate = (template: CareNoteTemplate) => {
    const dirty = content.trim() || prayerRequest.trim() || statusNote.trim();
    if (dirty && !window.confirm(`쓰던 내용을 "${template.name}" 양식으로 바꿀까요?`)) return;
    if (template.typeId) setTypeId(template.typeId);
    setContent(template.content);
    setPrayerRequest(template.prayerRequest ?? '');
    setStatusNote(template.statusNote ?? '');
    setPicked(new Map());
  };

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <TemplateBar
        onApply={applyTemplate}
        draft={{ typeId: activeTypeId, content, prayerRequest: prayerRequest || null, statusNote: statusNote || null }}
      />
      <div className="flex flex-wrap gap-1.5">
        {selectable.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            기록 종류가 없습니다. 교인 화면의 “재적상태·사역 역할·기록 종류 관리”에서 먼저 등록하세요.
          </p>
        ) : (
          selectable.map(item => (
            <TagChipButton
              key={item.id}
              name={item.name}
              seed={item.id}
              onClick={() => setTypeId(item.id)}
              className={cn(item.id === activeTypeId && 'ring-1 ring-[var(--color-foreground)] ring-inset')}
            />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-40" />
        <Input placeholder="장소 (선택)" value={location} onChange={event => setLocation(event.target.value)} />
      </div>

      <Textarea
        placeholder="본문 — @이름 으로 다른 교인을 언급할 수 있습니다"
        value={content}
        onChange={event => setContent(event.target.value)}
        onMention={member => setPicked(current => new Map(current).set(member.id, member.name))}
        rows={3}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />
      <Textarea
        placeholder="기도제목 (선택)"
        value={prayerRequest}
        onChange={event => setPrayerRequest(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />
      <Textarea
        placeholder="현재 상황 (선택)"
        value={statusNote}
        onChange={event => setStatusNote(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" onClick={submit} disabled={!content.trim() || createMut.isPending}>
          저장
        </Button>
      </div>
    </div>
  );
}

/**
 * 기록 양식 — 노션의 템플릿처럼 자주 쓰는 틀을 골라 채운다. 교회 전체가 함께 쓴다.
 * 지금 쓰던 내용(종류·본문·기도제목·현재 상황)을 그대로 양식으로 저장할 수 있다.
 */
function TemplateBar({ onApply, draft }: { onApply: (template: CareNoteTemplate) => void; draft: Omit<CareNoteTemplate, 'id' | 'name'> }) {
  const queryClient = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ['care-note-templates'], queryFn: listCareNoteTemplates });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const saveMut = useMutation({
    mutationFn: () => createCareNoteTemplate({ ...draft, name: name.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-note-templates'] });
      setNaming(false);
      setName('');
    },
    onError: error => window.alert(error instanceof Error ? error.message : '양식을 저장하지 못했습니다.'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCareNoteTemplate(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['care-note-templates'] }),
  });

  if (templates.length === 0 && !draft.content.trim()) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-[var(--color-muted-foreground)]">양식</span>
      {templates.map(template => (
        <span key={template.id} className="group inline-flex items-center rounded-full bg-[var(--color-muted)] pr-1 pl-2.5">
          <button type="button" onClick={() => onApply(template)} className="py-1 font-medium">
            {template.name}
          </button>
          <button
            type="button"
            aria-label={`"${template.name}" 양식 삭제`}
            title="양식 삭제"
            onClick={() =>
              window.confirm(`"${template.name}" 양식을 지울까요? 이미 쓴 기록은 그대로입니다.`) && deleteMut.mutate(template.id)
            }
            className="ml-0.5 rounded-full p-0.5 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--color-foreground)] focus-visible:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {draft.content.trim() &&
        (naming ? (
          <Input
            autoFocus
            emoji={false}
            value={name}
            maxLength={40}
            placeholder="양식 이름 (Enter)"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') setNaming(false);
              if (isSubmitEnter(event) && name.trim()) {
                event.preventDefault();
                saveMut.mutate();
              }
            }}
            onBlur={() => !name.trim() && setNaming(false)}
            className="h-7 w-40 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="rounded-full px-2 py-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            title="지금 쓴 내용을 양식으로 저장"
          >
            + 이 내용을 양식으로
          </button>
        ))}
    </div>
  );
}
