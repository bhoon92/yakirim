import type { ReactNode } from 'react';
import { useTriggerAutocomplete } from '@/lib/autocomplete/use-trigger-autocomplete';
import { loadEmojiIndex } from './emoji-index';
import { searchEmoji, type EmojiEntry } from './search';

const searchIndex = async (query: string) => searchEmoji(await loadEmojiIndex(), query);

/** 노션처럼 입력칸에서 `:기도` → 🙏. 입력칸에 `ref` 를 달고 `popup` 을 함께 렌더하면 된다. */
export function useEmojiShortcode<T extends HTMLInputElement | HTMLTextAreaElement>(
  enabled = true
): {
  ref: (field: T | null) => void;
  popup: ReactNode;
} {
  return useTriggerAutocomplete<T, EmojiEntry>({
    enabled,
    trigger: ':',
    label: '이모지',
    search: searchIndex,
    getKey: entry => entry.emoji,
    toText: entry => entry.emoji,
    renderItem: entry => (
      <>
        <span className="text-lg leading-none">{entry.emoji}</span>
        <span className="truncate">{entry.label}</span>
      </>
    ),
  });
}
