import type { KeyboardEvent } from 'react';

/**
 * "입력 확정"용 Enter 인지. 한글(IME) 조합 중에 누른 Enter 는 아니다.
 *
 * 한글을 치고 Enter 를 누르면 브라우저가 keydown 을 두 번 보낸다 — 조합을 끝내는 Enter(isComposing)와 실제 Enter.
 * 둘 다 저장으로 받으면 요청이 두 번 나가 두 번째가 "같은 이름" 제약에 걸렸다 (조직도에 "찬양팀" 추가 → 500).
 * keyCode 229 는 isComposing 을 안 주는 오래된 브라우저(사파리 일부)용.
 */
export function isSubmitEnter(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229;
}
