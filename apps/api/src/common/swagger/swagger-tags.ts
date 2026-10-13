/**
 * Swagger 태그 정의 — 문서 사이드바의 그룹이자 "이 도메인이 무슨 일을 하는가" 설명.
 * 여기 선언한 순서대로 /docs 에 노출된다 (알파벳 정렬 안 함).
 * 컨트롤러에서는 반드시 이 상수를 @ApiTags 에 넘길 것 (문자열 직접 입력 금지 — 오타 시 그룹이 쪼개짐).
 */
export const SwaggerTag = {
  SYSTEM: 'system',
  AUTH: 'auth',
  CHURCH: 'church',
  DASHBOARD: 'dashboard',
  MEMBER: 'member',
  TRAINING: 'training',
  MISSIONARY: 'missionary',
  RESIDENT: 'resident',
  AFFILIATION: 'member-affiliation',
  POSITION: 'member-role',
  ORGANIZATION_CHART: 'organization-chart',
  CARE_NOTE: 'care-note',
  ATTENDANCE: 'attendance',
  FINANCE: 'finance',
  CALENDAR: 'calendar',
  GOOGLE_CALENDAR: 'google-calendar',
  GALLERY: 'gallery',
  EXPORT: 'export',
  IMPORT: 'import',
  TEAM: 'team',
  REFERENCE: 'reference',
} as const;

export const SWAGGER_TAG_DESCRIPTIONS: ReadonlyArray<{ name: string; description: string }> = [
  {
    name: SwaggerTag.SYSTEM,
    description: '헬스체크 등 인프라용 엔드포인트. 인증 없음.',
  },
  {
    name: SwaggerTag.AUTH,
    description: [
      'Google OAuth 로그인과 세션 관리.',
      '',
      '흐름: `GET /auth/google` → 구글 동의 → `GET /auth/google/callback` 에서 계정 upsert 후',
      'access(2h) / refresh(30d) 토큰을 **httpOnly 쿠키**로 심고 웹으로 리다이렉트한다.',
      '소속 교회가 여러 개면 `POST /auth/select-church` 로 활성 교회를 정하고 JWT를 재발급받는다',
      '(= 이후 모든 도메인 API 의 churchId 스코프).',
    ].join('\n'),
  },
  {
    name: SwaggerTag.CHURCH,
    description: '교회 생성(온보딩)과 현재 활성 교회 조회. 첫 교회를 만든 계정은 owner 멤버십을 갖는다.',
  },
  {
    name: SwaggerTag.DASHBOARD,
    description: '홈 화면용 요약 집계. **양성 파이프라인 중심** — 현재 파송 인원·올해 파송·진행 중 훈련·단계별 인원.',
  },
  {
    name: SwaggerTag.MEMBER,
    description: [
      '교인 명부 CRUD·검색과 재적상태 관리. 모든 조회는 활성 교회로 스코프된다.',
      '',
      '재적상태는 단순 분류가 아니라 **양성 파이프라인 단계**다: 방문 → 새가족 → 정착 → 훈련생 → 사역자 → 파송.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.TRAINING,
    description: [
      '훈련 도메인 — 이 교회의 핵심. 4단 구조로 되어 있다.',
      '',
      '- 과정(courses): 반복해서 여는 훈련의 틀 (믿음학교, 수련회 …)',
      '- 기수(cohorts): 실제로 사람이 붙는 단위 (믿음학교 5기). 개설 시 회차가 자동 생성된다.',
      '- 회차(sessions): 출석 체크 단위 (5기 3주차)',
      '- 수강(enrollments): 기수 × 교인. `enrolled` → `completed` / `dropped`',
      '',
      '**예배 출석과는 완전히 별개 테이블**이다(집계 단위가 다름). 수료는 출석률로 자동 판정하지 않고 담당자가 확정한다.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.MISSIONARY,
    description: [
      '선교사 파송 트랙. 교인 1명당 프로필 최대 1개이며, 단계 전이는 이력으로 남는다.',
      '',
      '단계: 후보(candidate) → 훈련(training) → 파송확정(commissioned) → 현지(field) → 안식년(furlough) → 복귀(returned) / 종료(ended)',
      '',
      '파송(commissioned 이후) 상태가 되면 교인의 재적상태도 "파송"으로 바뀌어 **출석 명단에서 빠진다**.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.RESIDENT,
    description: [
      '공동체 간사 — 공동생활을 하며 내부에서 섬기는 선교사. 교인 1명당 프로필 최대 1개.',
      '',
      '해외 파송(missionary)과 별개 트랙이다. 하우스·사역팀·역할은 교인의 소속·사역 역할을 그대로 읽고,',
      '케어·재훈련 기록은 양육기록(care-note)에 종류로 남긴다.',
      '상태(활동/안식/퇴소)는 교회별 기준정보이며 `countsAsActive` 만 코드가 아는 규약이다.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.AFFILIATION,
    description: '교인의 소속(기관 / 사역팀 / 공동체) 배정·해제와 리더 지정. 해제는 이력 삭제가 아니라 종료(endDate) 처리.',
  },
  {
    name: SwaggerTag.POSITION,
    description: '사역 역할 부여와 종료 (구 직분). 새 역할을 주면 현재 역할을 자동 종료하고 새 이력을 만든다 (한 트랜잭션).',
  },
  {
    name: SwaggerTag.ORGANIZATION_CHART,
    description: '연도별 조직도 트리 — 기관/사역팀/공동체 + 리더·구성원을 한 번에 조립해 반환.',
  },
  {
    name: SwaggerTag.CARE_NOTE,
    description: '심방·면담·양육·상담·파송보고 기록. 민감 정보이므로 viewer 역할은 읽기도 불가 (care:read 는 staff 이상).',
  },
  {
    name: SwaggerTag.ATTENDANCE,
    description: '예배·날짜별 출석 명단 조회와 출석 체크(토글).',
  },
  {
    name: SwaggerTag.FINANCE,
    description: [
      '재정 도메인 전체.',
      '',
      '- 회계연도(fiscal-years): 예산·집행의 기준 기간. 하나가 current.',
      '- 예산(budgets): 회계연도 × 계정과목별 배정액.',
      '- 헌금(offerings): 교인별 헌금 입력·집계.',
      '- 수입지출(transactions): 실제 현금 흐름.',
      '- 영수증(receipt): 연말정산 기부금영수증 PDF.',
      '- 대시보드(dashboard): 예산 대비 집행/헌금 요약.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.CALENDAR,
    description: [
      '교회 일정. 캘린더(분류) → 일정(events) 구조이며 반복 일정은 recurrence 규칙으로 저장한다.',
      '',
      '구독(subscription)은 계정별 feedToken 을 발급하고, 캘린더 앱은 인증 쿠키 없이',
      '`GET /c/{token}.ics` 로 iCal 을 읽어간다 (토큰이 곧 인증 — 유출 시 regenerate).',
    ].join('\n'),
  },
  {
    name: SwaggerTag.GOOGLE_CALENDAR,
    description: [
      '교회 일정을 사용자의 구글 캘린더로 **push** 하는 연동 (읽기 동기화 아님).',
      '',
      'connect 로 동의 URL 을 받아 이동 → callback 에서 refresh token 저장 + 전용 구글 캘린더 생성,',
      'sync 로 기존 미래 일정을 일괄 반영, 이후 일정 변경 시 자동 push.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.GALLERY,
    description: [
      '행사(앨범) 와 사진. 업로드는 2단계: `POST .../photos/presign` 으로 S3 presigned URL 을 받아',
      '브라우저가 S3 로 직접 PUT 한 뒤, `POST .../photos` 로 메타데이터를 확정한다.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.EXPORT,
    description: '헌금·수입지출·예산·교인 명부를 XLSX 파일로 내려준다. 응답은 JSON 이 아니라 바이너리.',
  },
  {
    name: SwaggerTag.IMPORT,
    description: [
      '엑셀(XLSX)로 기존 명부를 한 번에 들여온다. 도입 첫날 수백 명을 손으로 입력하지 않기 위한 경로.',
      '',
      '- `GET /import/members/template` 로 서식을 받는다. 열 구성은 **교인 명부 내보내기와 동일**해서',
      '  내보내기 → 수정 → 가져오기 왕복이 된다.',
      '- `POST /import/members` 는 `dryRun` 을 먼저 태워 무엇이 생성·수정·거절되는지 확인한 뒤 실제 반영한다.',
      '- 같은 이름+연락처가 이미 있으면 **수정**, 없으면 생성. 재적상태 이력도 함께 적립된다.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.TEAM,
    description: [
      '이 교회를 관리하는 계정(멤버십)과 역할 관리. 역할은 owner / admin / staff / viewer 4종 고정이며',
      '역할 → 권한 매핑이 모든 엔드포인트의 403 판정 기준이다.',
    ].join('\n'),
  },
  {
    name: SwaggerTag.REFERENCE,
    description: [
      '기준정보(코드 테이블) — 기관·사역팀·공동체·사역역할·예배·헌금항목·계정과목.',
      '',
      '기관/사역팀/공동체는 **연도별**로 관리되어 조회·생성에 `year` 쿼리가 필수이고, `POST .../copy` 로',
      '작년 구성을 새 연도로 복제한다. 사역역할·예배·헌금항목·계정과목은 연도 개념이 없다.',
      '',
      '교회를 만들면 이 기준정보와 훈련 과정 기본값이 자동으로 시드된다.',
    ].join('\n'),
  },
];
