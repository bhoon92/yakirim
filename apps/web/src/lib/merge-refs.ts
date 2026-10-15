import type { Ref, RefCallback } from 'react';

/** 한 요소에 ref 를 여럿 단다 (부모가 넘긴 ref + 컴포넌트 안에서 쓰는 ref). */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return value => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}
