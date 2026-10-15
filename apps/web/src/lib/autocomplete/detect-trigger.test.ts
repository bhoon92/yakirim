import { describe, expect, it } from 'vitest';
import { detectTrigger } from './detect-trigger';
import { mentionsInText } from './use-member-mention';

describe('detectTrigger("@")', () => {
  it('줄 처음·공백 뒤의 @이름을 찾는다 (한글 포함)', () => {
    expect(detectTrigger('@김', 2, '@')).toEqual({ start: 0, query: '김' });
    expect(detectTrigger('오늘 @박간사', 7, '@')).toEqual({ start: 3, query: '박간사' });
  });

  it('메일 주소 안의 @ 에서는 뜨지 않는다', () => {
    expect(detectTrigger('mail a@b', 8, '@')).toBeNull();
  });

  it('트리거마다 따로 — `:` 는 `@` 로 안 잡힌다', () => {
    expect(detectTrigger(':기도', 3, '@')).toBeNull();
    expect(detectTrigger(':기도', 3, ':')).toEqual({ start: 0, query: '기도' });
  });
});

describe('mentionsInText', () => {
  it('본문에 "@이름" 이 남아 있는 사람만 보낸다 — 지운 언급은 빠진다', () => {
    const picked = new Map([
      [1, '김성도'],
      [2, '이성도'],
    ]);
    expect(mentionsInText('@김성도 와 함께', picked)).toEqual([1]);
    expect(mentionsInText('아무도 없음', picked)).toEqual([]);
  });
});
