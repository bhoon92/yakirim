import type { ReactNode } from 'react';
import { listMembers } from '@/api/members';
import { Avatar } from '@/components/ui/avatar';
import { useTriggerAutocomplete } from './use-trigger-autocomplete';

export type MentionedMember = { id: number; name: string };

const searchMembers = async (query: string): Promise<(MentionedMember & { statusName: string | null })[]> =>
  (await listMembers({ q: query, pageSize: 6 })).items.map(member => ({ id: member.id, name: member.name, statusName: member.statusName }));

/**
 * 노션처럼 `@이름` 으로 교인을 언급한다. 본문에는 "@이름 " 글자가 들어가고, 고른 교인은 onPick 으로 알린다
 * (저장할 때 본문에 남아 있는 "@이름" 만 골라 id 로 보낸다 — care-note-section 참고).
 */
export function useMemberMention<T extends HTMLInputElement | HTMLTextAreaElement>(
  onPick: ((member: MentionedMember) => void) | undefined
): { ref: (field: T | null) => void; popup: ReactNode } {
  return useTriggerAutocomplete<T, MentionedMember & { statusName: string | null }>({
    enabled: Boolean(onPick),
    trigger: '@',
    label: '교인 언급',
    search: searchMembers,
    getKey: member => member.id,
    toText: member => `@${member.name} `,
    onPick: member => onPick?.({ id: member.id, name: member.name }),
    renderItem: member => (
      <>
        <Avatar name={member.name} size="sm" />
        <span className="min-w-0 flex-1 truncate">{member.name}</span>
        {member.statusName && <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">{member.statusName}</span>}
      </>
    ),
  });
}

/** 저장 직전 — 본문에 "@이름" 이 아직 남아 있는 사람만. 지운 언급은 빠진다. */
export function mentionsInText(text: string, picked: Map<number, string>): number[] {
  return Array.from(picked.entries())
    .filter(([, name]) => text.includes(`@${name}`))
    .map(([id]) => id);
}
