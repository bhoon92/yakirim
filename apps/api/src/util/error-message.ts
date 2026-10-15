export function typeErrorMsg(name: string, type: string) {
  return { message: `${name} 은/는 ${type} 타입이어야 합니다.` };
}
export function rangeErrorMsg(name: string, min?: number, max?: number) {
  return { message: `${name} 은/는 ${min ? min + '자 이상 ' : ''}${max ? max + '자 이하 ' : ''}이어야 합니다.` };
}
export function formatErrorMsg(format: string) {
  return { message: `${format} 형식이 올바르지 않습니다.` };
}
export function minNumberErrorMsg(name: string, minValue: number) {
  return { message: `${name} 은/는 ${minValue} 이상 숫자여야 합니다.` };
}
export function maxNumberErrorMsg(name: string, maxValue: number) {
  return { message: `${name} 은/는 ${maxValue} 이하 숫자여야 합니다.` };
}
export function requiredErrorMsg(name: string) {
  return { message: `${name} 은/는 필수 입력 항목입니다.` };
}
export function enumErrorMsg(name: string) {
  return { message: `${name} 은/는 입력할 수 없는 값이 입력되었습니다.` };
}
export function lengthErrorMsg(name: string, length: number) {
  return { message: `${name}의 길이는 ${length}자 이어야 합니다.` };
}
