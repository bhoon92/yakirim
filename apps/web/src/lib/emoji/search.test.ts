import { describe, expect, it } from 'vitest';
import { detectShortcode, searchEmoji, type EmojiEntry } from './search';

describe('detectShortcode', () => {
  it('줄 처음이나 공백 뒤의 `:검색어` 를 찾는다', () => {
    expect(detectShortcode(':기도', 3)).toEqual({ start: 0, query: '기도' });
    expect(detectShortcode('감사 :pray', 8)).toEqual({ start: 3, query: 'pray' });
  });

  it('시간·주소·숫자에서는 뜨지 않는다', () => {
    expect(detectShortcode('10:30', 5)).toBeNull();
    expect(detectShortcode('https://yakirim', 15)).toBeNull();
    expect(detectShortcode('점수 :100', 7)).toBeNull();
    expect(detectShortcode('끝 :', 3)).toBeNull();
  });

  it('커서 앞까지만 본다 — 뒤에 글자가 있어도 된다', () => {
    expect(detectShortcode(':기도 제목', 3)).toEqual({ start: 0, query: '기도' });
    expect(detectShortcode(':기도 제목', 6)).toBeNull();
  });
});

describe('searchEmoji', () => {
  const index: EmojiEntry[] = [
    { emoji: '🥰', label: '하트와 함께 웃는 얼굴', keys: ['사랑'] },
    { emoji: '🙏', label: '기도', keys: ['감사', 'pray'] },
    { emoji: '♥️', label: '하트', keys: ['hearts'] },
    { emoji: '📿', label: '묵주', keys: ['기도', 'prayer_beads'] },
  ];

  it('이름이 똑같은 것 → 이름으로 시작 → 태그가 똑같은 것 순', () => {
    expect(searchEmoji(index, '하트').map(e => e.emoji)).toEqual(['♥️', '🥰']);
    expect(searchEmoji(index, '기도').map(e => e.emoji)).toEqual(['🙏', '📿']);
  });

  it('영어 단축어로도 찾는다', () => {
    expect(searchEmoji(index, 'PRAY').map(e => e.emoji)).toEqual(['🙏', '📿']);
  });

  it('한글 조합 중인 마지막 낱자는 빼고 찾는다 (":하ㅌ" → "하")', () => {
    expect(searchEmoji(index, '하ㅌ').map(e => e.emoji)).toEqual(['🥰', '♥️']);
  });

  it('없으면 빈 목록', () => {
    expect(searchEmoji(index, 'zzz')).toEqual([]);
    expect(searchEmoji(index, 'ㅎ')).toEqual([]);
  });
});
