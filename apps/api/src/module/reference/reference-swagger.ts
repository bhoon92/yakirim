import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/**
 * 기준정보 7종(부서·사역팀·목장·직분·예배·헌금항목·계정과목)은 같은 ReferenceService 를 공유하는
 * 동일 형태의 CRUD 다. 컨트롤러마다 같은 문장을 복사하지 않도록 Swagger 설명을 여기 모아둔다.
 */

/** 부서·사역팀·목장 = 연도별로 따로 관리되는 기준정보. */
export const YEARLY_NOTE = '이 기준정보는 **연도별**로 분리되어 있어 `year` 쿼리가 필수다.';

export function listDescription(what: string, yearly: boolean): string {
  return [`${what} 목록을 sortOrder 순으로 반환한다. 읽기는 별도 권한 없이 로그인 + 활성 교회만 요구.`, yearly ? `\n${YEARLY_NOTE}` : '']
    .join('')
    .trim();
}

export function createDescription(what: string, yearly: boolean): string {
  return [`${what}을(를) 새로 만든다. 이름은 1~40자.`, yearly ? `\n${YEARLY_NOTE} (해당 연도로 생성된다)` : ''].join('').trim();
}

export function updateDescription(what: string): string {
  return `${what}의 이름·설명·정렬순서·활성여부를 수정한다. 보낸 필드만 반영된다.`;
}

export function removeDescription(what: string): string {
  return `${what}을(를) 삭제한다. 이미 사용 중(교인 소속·헌금 기록 등)이라면 삭제보다 \`isActive: false\` 로 내리는 편이 안전하다.`;
}

export function copyDescription(what: string): string {
  return [
    `이전 연도의 ${what} 구성을 새 연도로 **복제**한다 (연초 조직 개편용).`,
    '',
    '- `from`: 복사할 원본 연도, `to`: 만들 대상 연도',
    '- 복제되는 것은 기준정보 자체(이름/정렬)뿐이며 교인 소속은 따라오지 않는다.',
  ].join('\n');
}

/** 연도별 기준정보의 목록/생성용 `year` 쿼리. */
export const ApiYearQuery = () =>
  ApiQuery({ name: 'year', required: true, type: Number, description: '대상 연도 (예: 2026)', example: 2026 });

/** copy 엔드포인트의 from/to 쿼리. */
export const ApiCopyYearQueries = () =>
  applyDecorators(
    ApiQuery({ name: 'from', required: true, type: Number, description: '복사할 원본 연도', example: 2025 }),
    ApiQuery({ name: 'to', required: true, type: Number, description: '복사 대상 연도', example: 2026 })
  );
