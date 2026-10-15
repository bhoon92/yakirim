import { useMemo, type ComponentProps } from 'react';

import { useMemberMention, type MentionedMember } from '@/lib/autocomplete/use-member-mention';
import { useEmojiShortcode } from '@/lib/emoji/use-emoji-shortcode';
import { mergeRefs } from '@/lib/merge-refs';

/**
 * 여러 줄 입력칸 — 모양은 쓰는 곳이 className 으로 정한다. `:이름` 이모지 입력이 붙어 있고,
 * `onMention` 을 주면 `@이름` 으로 교인을 언급할 수 있다.
 */
export function Textarea({ ref, onMention, ...props }: ComponentProps<'textarea'> & { onMention?: (member: MentionedMember) => void }) {
  const shortcode = useEmojiShortcode<HTMLTextAreaElement>();
  const mention = useMemberMention<HTMLTextAreaElement>(onMention);
  const mergedRef = useMemo(() => mergeRefs(ref, shortcode.ref, mention.ref), [ref, shortcode.ref, mention.ref]);
  return (
    <>
      <textarea ref={mergedRef} {...props} />
      {shortcode.popup}
      {mention.popup}
    </>
  );
}
