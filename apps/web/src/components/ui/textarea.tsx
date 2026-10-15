import { useMemo, type ComponentProps } from 'react';

import { useEmojiShortcode } from '@/lib/emoji/use-emoji-shortcode';
import { mergeRefs } from '@/lib/merge-refs';

/** 여러 줄 입력칸 — 모양은 쓰는 곳이 className 으로 정한다. `:이름` 이모지 입력이 붙어 있다. */
export function Textarea({ ref, ...props }: ComponentProps<'textarea'>) {
  const shortcode = useEmojiShortcode<HTMLTextAreaElement>();
  const mergedRef = useMemo(() => mergeRefs(ref, shortcode.ref), [ref, shortcode.ref]);
  return (
    <>
      <textarea ref={mergedRef} {...props} />
      {shortcode.popup}
    </>
  );
}
