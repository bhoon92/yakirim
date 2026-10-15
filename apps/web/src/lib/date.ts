/** 로컬 타임존 기준 YYYY-MM-DD. toISOString()은 UTC라 한국 밤 시간에 날짜가 하루 밀린다. */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 오늘 날짜(로컬) YYYY-MM-DD. */
export function todayString(): string {
  return toDateString(new Date());
}
