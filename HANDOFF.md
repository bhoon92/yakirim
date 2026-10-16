# 세션 핸드오프

> 최종 갱신: 2026-10-13
> 브랜치: `develop` (CI/CD 없이 develop 직접 커밋, **푸시는 사용자가 수동으로**)
> **이 문서는 git 추적 대상이다.** 작업을 이어받는 데 필요하므로 레포에 둔다.
> 설계 근거는 `planning.md` **00장** (같이 추적한다).

---

## 0. 이어받는 사람이 가장 먼저 읽을 것

이 프로젝트는 **키퍼스처치**(청년 중심, "전 성도의 선교사화"가 목표)를 위한 교회 관리 도구다.
그래서 출석·헌금보다 **양성 파이프라인**(방문 → 새가족 → 정착 → 훈련생 → 사역자 → 파송)이 중심축이다.

### 작업 규칙 (지키지 않으면 사고가 난다)

| 규칙 | 이유 |
| --- | --- |
| **개발 서버를 건드리지 말 것.** 코드 고쳤으면 **저장만** 한다 | `nest --watch` / Vite HMR 이 알아서 반영한다. `pnpm build:api` 는 `deleteOutDir` 로 `dist` 를 비워서, watch 가 도는 중에 실행하면 **앱 프로세스가 죽는다**(§3.1) |
| 검증은 `cd apps/web && npx tsc -b && npx eslint src` + curl | 둘 다 서버에 영향이 없다 |
| **마이그레이션은 손으로 쓴다** | `migrationsRun: true` + watch 조합에서 생성기 초안이 손보기 전에 자동 실행된다(§3.1) |
| 적용 후 **반드시 `psql` 로 눈으로 확인** | "실행됐다"와 "내가 의도한 게 실행됐다"는 다르다 |
| 사용자 응답은 **존댓말** | 코드 주석·이 문서의 문체는 기존대로 평서체 |
| 날짜는 `todayString()` 만 | `toISOString()` 은 UTC 라 `TZ=Asia/Seoul` 새벽 0~9시에 어제가 된다(§3.3) |

### 현재 상태 한 줄

Render(**main** 자동 배포) + Neon 으로 운영 중. 작업은 브랜치 → PR → develop 머지, 운영 배포는 develop → main 릴리스 PR(일반 머지, squash 금지).
develop·main 둘 다 보호 브랜치(PR 필수 · CI `check` 필수 · 관리자 포함). 머지된 작업 브랜치는 GitHub 이 자동 삭제.
이슈는 개인 노션 Yakirim > Kanban Board ✅ Tasks 에서 관리한다.

- 서버: API 3030 / 웹 5173 (둘 다 사용자 터미널에서 `pnpm dev:api` / `pnpm dev:web`)
- DB: 교회 1 · **교인 309** · 상태이력 309 · 훈련 기수 5 · 선교사 3 · 기록 종류 6
- 마이그레이션 7개, 전부 적용

---

## 1. 이번 세션에서 한 일

커밋 15건 / 95 파일 / +3,617 −1,103. 기준점 `a497949`.

```
ad66cc8 [FIX]      교인 카드가 평신도에게도 파송 이야기로 시작하던 문제
e6f430a [REFACTOR] 양육기록 종류를 enum → 기준정보 테이블로
da8eac6 [FEAT]     양육 기록에 "심방" 종류 되살리기
e9913b6 [FEAT]     교인 목록에 역할·소속 태그 표시
da9ac9e [FIX]      기준정보 삭제 — 사용 중인 걸 조용히 지우거나, 이유를 안 알려주던 문제
30952e3 [FIX]      API 가 꺼진 걸 "로그인 실패"로 보여주던 문제
d5d8385 [FEAT]     소속·사역 역할 태그에 색 입히기 (노션 다중선택처럼)
f955527 [FEAT]     기수 번호 자동 채번 제거 — 이름을 직접 적고 나중에 고칠 수 있게
91dce9f [FEAT]     정체 기준 일수를 교회가 직접 바꿀 수 있게
357d6cb [FIX]      300명 규모에서 드러난 것 — 목록 페이징·정체 명단 도달·매트릭스 고정
943fd09 [FEAT]     교인 명부 엑셀 가져오기 — 미리보기 먼저, 그다음 반영
95dac86 [FEAT]     재적상태 이력 — 파이프라인 "통과"를 기록하고 정체를 찾는다
cef315d [FEAT]     훈련·선교사 — 빠져 있던 삭제·상태 변경을 화면에 연결
63201c5 [FIX]      인라인 패널 토글 버튼이 상태를 반영하도록
a79a41b [STYLE]    flex 실측 토큰으로 디자인 재정렬
```

### 1.1 flex 디자인 — 감이 아니라 실측값
flex 가 실제로 배포하는 CSS 번들(`flex.team/landing-static/_next/static/css/*.css`)에서 vanilla-extract 토큰을
그대로 가져왔다. 회색은 `#242a30` 파생(푸른기), 모서리 기본 8px(최빈 6px), 글자 14·13·12px, 본문 굵기 500.
`--text-*` / `--radius-*` 를 **스케일째 재매핑**해서 화면 코드를 안 건드리고 밀도만 내렸다.

### 1.2 재적상태 이력 (이 세션의 중심)
`member.status_id` 는 현재값만 있어서 **파이프라인 통과를 기록하지 않고 있었다.** 소속·직분·훈련·파송은
전부 시점이 있는데 정작 축인 재적상태만 없던 비대칭. `member_status_history` 신설 + 정체 감지.

### 1.3 엑셀 가져오기
내보내기 4종은 있는데 **넣는 길이 없었다.** 미리보기(dryRun) → 반영 2단계. 300행 0.47초.

### 1.4 300명 규모 점검에서 나온 것
9명으로는 다 잘 도는 것처럼 보였다. 실제 규모를 넣자 **교인 목록에 페이지네이션 UI 가 아예 없다**는 게 드러났다
(309명 중 첫 20명만 볼 수 있었다). 대시보드가 "189명"이라면서 그 명단에 갈 수 없던 것, 훈련 매트릭스에서
스크롤하면 이름 열이 사라지던 것도 함께 고쳤다.

### 1.5 "평신도" 교정 — 사용자 지적
교인 카드가 **모두에게** 파송 트랙으로 시작했다. 훈련도 파송도 없는 교인 300명에게도 맨 위가
"파송 트랙에 등록되지 않은 교인입니다"였다. 순서를 **사역 역할 → 소속 → 기록 → 양성 경로**로 바꾸고,
훈련 이력·파송 트랙은 해당되는 사람에게만 보이게 했다.
**이 교회가 파송 중심이라도 교인 대부분은 평신도다** — 화면 기본값은 평신도여야 한다.

### 1.6 enum 두 개를 기준정보로
`기수 번호(ordinal)` → 이름 직접 입력, `양육기록 종류` → `care_note_type` 테이블.
둘 다 **코드가 그 값으로 분기하지 않는데** 교회 용어만 막고 있었다(§5 교훈의 반복).

---

## 2. 이어서 할 일

### 2.1 사용자만 할 수 있는 것
- **브라우저 확인** — 나는 화면을 볼 수 없다. 빌드·타입체크·lint·API 왕복까지가 한계
- **교회 담당자 확인** ⚠️ — 사역팀 5개·훈련 과정 3종·회차 수는 **2024년 기사 기반 추정**이다
  (`planning.md` 00.1). 훈련 도메인이 이 위에 통째로 올라가 있다. **세션 4번째 이월.**
  코드를 더 쌓기 전에 맞춰보는 게 비용이 가장 적다

### 2.2 배포 — Render(웹) + Neon(DB) 로 준비 완료, 계정 작업만 남음 (2026-10-14)

`render.yaml`(Blueprint) 추가. **DB 는 Render 무료 Postgres 를 쓰지 않는다** — 30일 만료·백업 없음. Neon 무료(만료 없음, SSL 필수 → `POSTGRES_DB_SSL=true`).
스크래치 복제본에서 Render 와 같은 명령으로 빌드 → `NODE_ENV=production` 기동까지 확인했다. 그때 잡은 것:
**SPA 딥링크 500** — ServeStatic `exclude: ['/api*']` 가 Express 5 문법이 아니라 요청마다 PathError. `'/api/{*path}'` 로 수정.

사용자가 할 일: ① Neon 프로젝트(싱가포르) ② Google OAuth 클라이언트 + 리디렉션 URI ③ Render Blueprint 연결 후 비밀값 입력.
첫 로그인 → 온보딩에서 교회를 만들면 키퍼스처치 기본값이 시드된다(데모 300명은 없다).

#### (이전 조사 기록)
코드는 준비돼 있다. `railway.toml`(NIXPACKS), `/api/health`, production 에서만 `setGlobalPrefix('api')`,
NestJS 가 `apps/web/dist` 를 직접 서빙, `.nvmrc` v22.17.1, pnpm allowBuilds 해결됨.

**부팅을 막는 변수**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — `GoogleStrategy` 가 부팅 시 생성되므로
비어 있으면 앱이 안 뜬다. **S3 4종은 나중에 해도 된다**(`S3Client` 는 요청 시점에 자격증명을 해석).

필요한 변수: `NODE_ENV` · **`TZ=Asia/Seoul`**(필수) · `POSTGRES_DB_*` · `JWT_CMS_*_SECRET_KEY` ×2 ·
`GOOGLE_*` · `WEB_BASE_URL`. `PORT` 는 플랫폼이 주입하므로 넣지 않는다.

플랫폼 비교(2026-10 기준 조사):

| 후보 | 월 비용 | 메모 |
| --- | --- | --- |
| **Render 무료** | $0 | 15분 유휴 시 잠듦, 복귀 ~1분. 월 750시간. **유일한 진짜 무료** |
| Railway Hobby | $5~8 | 가장 단순. 프로젝트 안에 Postgres 추가 가능 |
| Vercel | $20+ | **맞지 않음** — 서버리스라 부팅 마이그레이션·커넥션 풀이 깨지고 DB도 없다 |
| Fly.io | 유료 | 2024년에 신규 무료 티어 폐지 |

사용자가 Railway 프로젝트를 레포 연결로 만들어 둔 상태. 아직 변수·DB 미설정이라 첫 배포는 실패해 있을 것.
**결론은 "지금 단계에서는 돈 쓰지 말고, 보여줄 때 Render 무료로"** 쪽으로 기울어 있었다.

배포 순서: ① Postgres 추가 → ② 도메인 생성(변수에 넣어야 하므로 먼저) → ③ Google 리디렉션 URI 등록 →
④ 시크릿 생성 → ⑤ 변수 입력 → ⑥ **로그에서 마이그레이션·헬스체크 확인** → ⑦ `develop → main` 머지 후
watch branch 전환(지금 `main` 은 `Initial commit` 하나뿐이라 먼저 머지해야 한다) → ⑧ CI → ⑨ 브랜치 보호·Usage Limit.

### 2.3 CI — `.github/workflows/ci.yaml` (2026-10-14)
PR(develop·main 대상)과 develop·main 푸시마다: lint·prettier → 웹 빌드(`tsc -b`) → API 빌드 →
**빈 Postgres 16 에서 `NODE_ENV=production` 으로 부팅해 마이그레이션 전체 실행 + `/api/health`** →
**스키마 드리프트 검사**(`migration:generate --check` — 엔티티를 바꾸고 마이그레이션을 빠뜨리면 실패, 로그에 필요한 SQL 이 나온다).
드리프트 검사를 처음 돌렸을 때 `care_note_type` 인덱스 이름이 어긋나 있었다 → `1788240000000` 에서 이름만 맞췄다.

### 2.4 내가 남긴 미완성
| 항목 | 상태 |
| --- | --- |
| **테스트** | ✅ 2026-10-15 jest + **실제 Postgres**(`yakirim_test`, 매 실행 새로 만듦). 정체 판정(대시보드↔목록 대조)·상태 이력·회차 생성/재정렬·첫 출석 자동 시작·수료 제안·날짜·409. 파송 `countsAsActive` 연동(2026-10-15 추가) |
| 300명 데모 데이터 | 유지 여부 미결. 지우려면 §6 스니펫 |
| 기록 종류 기본값 | `파송보고` 가 아직 기본에 있다. 교인 카드에서 뺄지 사용자 답변 대기 |
| ~~소속 3블록~~ | ✅ 2026-10-14 "소속" 한 칸으로 합침 (있는 종류만 한 줄씩) |
| 교인 프로필 사진 | 컬럼 없음 → 이니셜 아바타. 컬럼 + S3(갤러리 인프라 재사용) |
| ~~이모지 직접 고르기~~ | ✅ 2026-10-15 훈련 과정·달력 레이어·갤러리 행사에 `icon` 컬럼 + `IconPicker`. null 이면 이름 해시 자동 |
| 조직 정렬 | 모달 제거 때 드래그 정렬이 빠졌다 |
| 조직 대분류 개수 | 3종 고정(각각 소속 이력 테이블 + `budget_allocation.target_kind`) |
| 조직 계층 | flex 는 3단, 우리는 2단. reference 에 `parentId` 필요 |
| 엑셀 | ✅ 2026-10-15 간사·선교사 명부 내보내기 추가. 훈련 이력 내보내기는 없음 / 가져오기는 교인만 |
| 출석 화면 | 신규 도메인(훈련·파송) 연계 없음 |

### 2.5 이월 (이전 세션부터)
- **`refreshToken` 평문 저장** — 구글 캘린더 연동 토큰. production 전 필수
- 반복 일정 후속(UNTIL·EXDATE), 갤러리 행사 수정, 회계연도 삭제 UI, FK `ON DELETE`,
  super admin 분리, Postgres RLS

---

## 3. 실패한 것 / 막혔던 것

### 3.1 ⚠️ `migrationsRun: true` + watch = 초안이 자동 실행된다 (이 세션에서 2번)
`config/*.js` 가 전부 `migrationsRun: true` 라 **API 가 부팅할 때마다 마이그레이션을 실행**한다.
`migration:generate` 로 파일이 생기는 순간 watch 가 재기동하면서 **손보기 전 초안을 그대로 돌린다.**

- 1회차: 시드·백필이 빠진 채 기록됨 → 이후 `migration:run` 은 "No migrations are pending" 만 뱉어 조용히 지나갈 뻔
- 2회차: 컬럼 교체 초안이 `ADD NOT NULL` 이라 기존 행에서 실패 → **부팅이 통째로 깨짐**(다행히 롤백은 깨끗)

**대응**: 마이그레이션은 **손으로 쓴다.** 생성기를 쓸 거면 생성 직후 즉시 고치고
`pnpm migration:revert` → 재실행. 어느 쪽이든 `psql` 로 결과를 확인한다.
컬럼 교체는 `널 허용 추가 → 백필 → NOT NULL 승격 → 옛 컬럼 제거` 순서.

### 3.2 API 가 여러 번 죽었다 — 원인은 전부 나였다
`pnpm build:api` 를 작업마다 돌렸는데 `deleteOutDir` 가 `dist` 를 비운다. watch 서버가 그 상태를 물고 죽고,
**watcher 는 살아 있어 자동 복구가 안 된다.** 화면에는 502 로만 보여서 "로그인이 안 된다"로 이어졌다.
→ §0 작업 규칙 참조. 저장만 하면 된다.

### 3.3 날짜에 `toISOString()` 을 쓰면 조용히 하루가 밀린다
UTC 변환이라 `TZ=Asia/Seoul` 에서 **00:00~09:00 사이엔 어제**다. 이 세션에서 API 7곳을 고쳤다
(심방·파송 확정일·역할 승직·소속 배정·수강 등록·헌금·수입지출).
→ **API 는 `@src/common/date` 의 `todayString()` / `toDateString()` 만 쓴다.**
pg 드라이버가 `date` 컬럼을 **JS `Date` 로 주는 경우**(원시 쿼리 `getRawMany`)가 함정이다.

### 3.4 자동 생성 마이그레이션은 초안이다
- 삭제된 엔티티의 테이블을 DROP 하지 않는다 / enum 을 rename 만 하고 DROP 하지 않는다
- **데이터 마이그레이션(시드·백필)은 아예 생성되지 않는다** — enum→FK 전환에서 이게 없으면 값이 통째로 날아간다
- 드리프트 검사는 알지 못하는 테이블·타입을 무시해서 이걸 못 잡는다

### 3.5 pnpm allowBuilds — 지우면 다시 생긴다
`pnpm-workspace.yaml` 의 `allowBuilds` 는 `true`/`false` 를 정해야 한다. 블록을 지우면 pnpm 이 다시 써넣는다.
(현재는 값이 정해져 있어 설치가 통과한다.)

### 3.6 TypeORM 컬럼 타입 추론 실패
`foo?: string | null` 유니온이면 `design:type` 이 `Object` 가 되어 죽는다 →
`@Column({ type: 'varchar', nullable: true })` 로 **명시**.

### 3.7 내가 확인하지 못한 것
- **브라우저 렌더링** — 화면은 사용자만 봤다
- **300명 화면** — API 응답만 쟀다. 실제로 그렸을 때의 스크롤·줄바꿈은 못 봤다

---

## 4. 유념해야 할 것

### 4.1 환경
- **Postgres 16 (Homebrew)** — DB `yakirim`, 역할 `root`/`root1234`, 포트 5432
  PATH: `/opt/homebrew/opt/postgresql@16/bin`
- **Docker 없음** → `pnpm db:up` / `db:reset` 사용 불가. 초기화는 `dropdb`/`createdb` 후 `migration:run`
- **direnv 필수** — 서버 코드가 dotenv 를 읽지 않아 셸 환경변수에 의존한다. `.envrc` 는 `direnv allow` 된 상태
- 포트: API 3030 / Vite 5173

### 4.2 이 프로젝트의 규칙
- **Vite 프록시가 `/api` 를 떼고 보낸다** → curl 로 3030 을 직접 칠 때는 `/api` 를 **붙이지 않는다**.
  브라우저와 같은 경로를 재현하려면 `http://localhost:5173/api/...`
- production 에서는 반대로 global prefix `api` 가 붙는다
- **Swagger 는 `stage !== production` 에서만**. 로컬 `/docs`, 스펙 `/docs-json`
- **`PartialType` 은 반드시 `@nestjs/swagger`** 에서 import
- **필요 권한을 컨트롤러 설명에 손으로 적지 말 것** — `@Permissions` 가 403 설명에 자동으로 넣는다
- `lint-staged` 는 `*.ts` 만 → `.tsx` 는 수동 검증
- **디자인 토큰은 `index.css` 단일 출처**(flex 실측값). 임의로 바꾸지 말 것
- **인라인 패널 토글은 `PanelToggle`**, **색 태그는 `TagChip`**(seed 는 기준정보 id)

### 4.3 도메인 계약 (깨면 조용히 잘못 동작한다)
- **재적상태를 바꾸는 모든 경로는 `MemberStatusHistoryService.record()` 를 지나야 한다.**
  직접 `member.statusId` 만 UPDATE 하면 이력이 끊기고 정체 조회에서 그 사람이 사라진다.
  경유지: 교인 등록·수정 / 파송 단계 자동 전환 / 선교사 등록 시 교인 동시 생성 / 엑셀 가져오기
- `member_status_history` 는 **열린 구간(`end_date IS NULL`)이 현재 상태**이고 `member.status_id` 와 일치해야 한다.
  부분 유니크 인덱스 때문에 **닫고 나서 열어야** 한다
- **정체 판정은 `STALLED_CONDITION` 한 문장**(member-status-history.service) — `listStalled()` 와 `MemberService.list()` 의 `stalled` 필터가 같이 쓴다.
  "오늘"은 DB `CURRENT_DATE` 가 아니라 `stalledParams()` 로 앱이 넘긴다(운영 DB 는 UTC). 두 결과가 같은지는 테스트가 대조한다
- **성도·간사는 2트랙** (2026-10-16 사용자) — 간사는 성도 단계의 다음 칸이 아니다. `resident_status.phase` = preparing(지원·면담·과정) / resident(활동·안식, 집계) / left. countsAsActive 는 phase 에서 맞춘다. 진입 → 간사로 옮기면 헌신일·입주일 자동. 재정 0 정리는 앱에 남기지 않는다(간사로 들어온 것 자체가 고백)
- **파이프라인 보드(`/app/pipeline`, `GET /members/pipeline`)** — 단계 이동은 따로 없고 `PATCH /members/:id {statusId}` (이력 record 경유). 정체 표시는 listStalled 와 같은 기준(테스트가 대조)
- **심방 기록 @멘션** — 본문엔 "@이름" 글자만, 연결은 `care_note.mentioned_member_ids`. 언급된 사람 카드에 백링크(`GET …/care-notes/mentions`). 자동완성은 `lib/autocomplete`(이모지 `:` 와 같은 훅)
- **글자 입력칸은 `Input` / `Textarea`(components/ui) 를 쓴다** — 노션처럼 `:이름` 이모지 입력(lib/emoji)이 붙어 있다. 맨 `<input>`/`<textarea>` 에는 안 붙는다
- **Enter 로 저장하는 입력칸은 `isSubmitEnter(event)`** — 맨 `event.key === 'Enter'` 는 웹 lint 가 막는다(한글 조합 중 Enter 두 번 → 요청 두 번)
- **훈련 출석 ≠ 예배 출석**: `training_attendance` vs `attendance`. 합치지 말 것
- **수료는 자동 판정하지 않는다** — 출석률은 참고용
- **파송 집계 기준은 `missionary_stage.counts_as_active` 플래그**(이름 아님).
  연동은 `member_status.systemKey`(`commissioned`/`worker`)로 상태를 찾는다 — **지우면 조용히 동작하지 않는다**
- **회차 삭제는 번호를 1부터 다시 매긴다.** 부분 유니크 인덱스라 **오름차순으로 당겨야** 충돌하지 않는다
- **기준정보 삭제는 `ReferenceService.remove(…, usages)` 가 막는다.** 새 기준정보를 만들면
  참조처를 반드시 선언할 것 — 안 하면 사용 중인 걸 조용히 지워 이력이 고아가 된다
- **조직 대분류 이름은 `useOrgLabels()` 훅으로만 읽는다**(4곳에 퍼져 있다)

### 4.4 마이그레이션 (13개, 전부 적용)
```
1782000000000  Initial                  손으로 작성. 인덱스·PK·enum 이름을 TypeORM 메타데이터에서 뽑아 맞췄다
1787815624967  MissionaryStageReference
1787897839931  ChurchOrganizationLabels
1787908505893  MemberStatusHistory      ⭐ 시드 + 기존 교인 백필이 손으로 들어가 있다
1788146600506  TrainingCohortName       ⭐ ordinal → name 백필
1788150000000  CareNoteVisitType
1788160000000  CareNoteTypeReference    ⭐ enum → FK 매핑 백필
1788170000000  ResidentStaff            ⭐ 간사 3테이블 + 기존 교회에 상태·기록 종류 시드
1788180000000  ResidentDuty             간사 맡은 사역(노션 다중 선택식 태그)
1788190000000  TrainingCourseStep       과정에 STEP 번호·수료 시 제안할 재적상태·간사 등록 제안
1788200000000  EnrollmentPromotionDismissed  수료 제안 넘기기 표시
1788210000000  MemberShepherd           담당 간사 (성도 1명당 열린 구간 하나)
1788220000000  ShepherdRole             membership_role_enum 에 shepherd 추가 (down 은 타입 재생성)
```
⭐ 표시는 **생성기가 만들지 못하는 데이터 마이그레이션**이 들어 있다는 뜻. 건드릴 때 주의.
`Initial` 의 인덱스 이름 규칙을 깨면 이후 `generate` 가 불필요한 rename diff 를 낸다.

### 4.5 로컬 데모 데이터
- 교회 1 `키퍼스처치` / 계정 `bhoon92@gmail.com`(owner)
- **교인 309명** — 원래 데모 9명(김믿음·이순종 …) + **엑셀 가져오기로 넣은 300명**.
  깔때기 분포이고 등록일을 과거로 흩뿌려서 **정체 189명**이 잡힌다. 화면을 실제 규모로 보라고 남겨둔 것
- 훈련 기수 5개(최대 60명 × 12회차) / 선교사 3명 / 소속 15건 / 기록 종류 6종
- 시드는 DB 직접 INSERT 가 아니라 **실제 API 를 태워서** 만들었다

---

## 5. 배운 것

- **분류를 enum 으로 박으면 교회가 자기 용어를 쓸 수 없다.** 이 세션에만 두 번 더 겪었다(기수 번호, 기록 종류).
  판단 기준이 생겼다 — **코드가 그 값으로 분기하지 않으면 enum 은 아무것도 얻지 못한다.**
  기본값은 "기준정보 테이블 + 코드가 아는 플래그 하나".
- **상태를 기록하지 않으면 그 상태로 아무것도 못 묻는다.** 파이프라인을 그리면서 통과를 기록하지 않으면
  분포만 보이고 이동·정체는 영원히 답할 수 없다. **이력은 소급이 안 되므로 늦을수록 손해다.**
- **데모 데이터가 작으면 화면 버그가 안 보인다.** 교인 9명일 땐 "페이지네이션이 아예 없다"는 걸 아무도 몰랐다.
  규모를 키워보는 게 UI 회귀 테스트를 대신한다.
- **"백엔드에 있다"와 "쓸 수 있다"는 다르다.** DELETE 엔드포인트 5개가 화면에 안 붙어 있었다.
  API 함수 목록과 화면 참조를 대조하는 스크립트(§6) 한 번이면 찾는다.
- **도메인의 중심축이 화면의 기본값이 되면 안 된다.** 이 교회가 파송 중심이라고 해서 모든 교인 카드가
  파송 이야기로 시작하면, 정작 대부분인 평신도에게는 쓸모없는 화면이 된다.
- **에러를 던지는 것과 전달하는 것은 다르다.** 서버는 "이 상태인 교인이 62명 있어 삭제할 수 없습니다"라고
  말하고 있었는데 클라이언트가 그걸 버리고 `delete memberStatus 409` 만 남겼다.
- **실패를 어떻게 보여주는지가 기능이다.** API 가 꺼진 걸 "로그인 실패"로 보여주면 사용자는 원인을 영원히 모른다.
- **API E2E 는 화면 검증이 아니다.** 158개 오퍼레이션을 다 찍어도 레이아웃 문제는 하나도 못 잡는다.

---

## 6. 실행 명령

```sh
# 서버 (각자 터미널에서 한 번만. 작업 중에 다시 띄우지 말 것 — §3.2)
pnpm dev:api
pnpm dev:web

# 검증 (서버에 영향 없음)
cd apps/api && pnpm test        # 테스트 — 로컬 Postgres 에 yakirim_test 를 새로 만들어 쓴다(개발 DB 는 안 건드림)
cd apps/web && npx tsc -b && npx eslint src

# 마이그레이션 — 손으로 작성 후
pnpm build:api && direnv exec . pnpm migration:run
psql -U root -h localhost -d yakirim -c "\d+ <table>"     # ⭐ 반드시 눈으로 확인
direnv exec . pnpm migration:revert                        # 초안이 먼저 실행돼 버렸을 때

# DB 접속
psql -U root -h localhost -d yakirim
# postgresql://root:root1234@localhost:5432/yakirim

# API 검증 (로컬은 /api 없이 · 브라우저 경로 재현은 5173 프록시로)
curl -s -c /tmp/cj.txt -X POST http://localhost:3030/auth/dev-login \
  -H 'Content-Type: application/json' -d '{"email":"bhoon92@gmail.com"}'
curl -s -b /tmp/cj.txt http://localhost:3030/members/stalled

# 한글 검색은 URL 인코딩 필요
curl -s -b /tmp/cj.txt "http://localhost:3030/members?q=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("김믿음"))')"

# 화면에 안 붙은 변경 엔드포인트 감사 (apps/web/src 에서 실행)
python3 - <<'PY'
import re, pathlib
api = sorted(pathlib.Path('api').glob('*.ts'))
blob = "\n".join(p.read_text() for p in list(pathlib.Path('routes').rglob('*.tsx')) + list(pathlib.Path('components').rglob('*.tsx')))
for f in api:
    for chunk in re.split(r'\nexport const ', f.read_text())[1:]:
        m0 = re.match(r'([A-Za-z0-9_]+)', chunk)
        if not m0: continue
        name, body = m0.group(1), chunk.split('\nexport ')[0]
        m = re.search(r"method: '(DELETE|PATCH|PUT|POST)'", body)
        if m and not re.search(r'\b'+re.escape(name)+r'\b', blob):
            print(m.group(1), f.name, name)
PY

# 300명 데모 데이터 제거 (원래 9명만 남긴다)
psql -U root -h localhost -d yakirim <<'SQL'
BEGIN;
DELETE FROM member_status_history WHERE member_id > 9;
DELETE FROM training_attendance WHERE enrollment_id IN (SELECT id FROM training_enrollment WHERE member_id > 9);
DELETE FROM training_enrollment WHERE member_id > 9;
DELETE FROM member WHERE id > 9;
COMMIT;
SQL
```

---

## 7. 참고

- `planning.md` **00장** = 키퍼스처치 기준 설계 근거(우선 문서). 1~5장은 일반 교회 가정이라 충돌 시 00장이 이긴다
- API 문서: http://localhost:3030/docs (스펙 `/docs-json`) — 엔드포인트 설명·필요 권한은 전부 여기
- 누적 히스토리: 기반(멀티테넌트·OAuth) → 재적/소속/직분 → 심방 → 출석 → 재정 → 영수증·엑셀 →
  갤러리+S3 → 달력+iCal → RBAC → 조직도+Google Calendar → references CRUD → 대시보드 실데이터 →
  배포 설정 → Swagger 정비 + 키퍼스처치 도메인 재편 + flex 디자인 + 조직도 2단 구조 →
  **(이번) flex 실측 토큰 · CRUD 감사 · 재적상태 이력/정체 감지 · 엑셀 가져오기 · 대규모 데이터 대응 ·
  기수 이름 직접 입력 · 태그 색상 · API 오프라인 안내 · 기준정보 삭제 가드 · 평신도 중심 교정**
