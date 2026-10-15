import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '@src/module/auth/auth.constants';
import { ConfigProvider } from '@src/config';
import { SWAGGER_TAG_DESCRIPTIONS } from './swagger-tags';

/** Swagger UI 경로. production 에서는 아예 마운트하지 않는다. */
export const SWAGGER_PATH = 'docs';

const DESCRIPTION = [
  '교회 관리 웹(Yakirim) 백엔드 API. 한 서버가 여러 교회를 담당하는 멀티테넌트 구조다.',
  '',
  '### 인증',
  `- 로그인은 Google OAuth 뿐이다. 성공 시 access/refresh JWT 가 **httpOnly 쿠키**(\`${ACCESS_TOKEN_COOKIE}\`)로 내려간다.`,
  '- 따라서 Swagger UI 에서 Authorize 로 토큰을 넣을 일은 거의 없다. 브라우저가 이미 쿠키를 갖고 있으면 Try it out 이 그대로 동작한다.',
  '- 쿠키가 없다면 `POST /auth/dev-login` (localdev 전용) 으로 세션을 만든 뒤 시도하면 된다.',
  '',
  '### 교회 스코프',
  '- JWT 에는 accountId 와 **활성 churchId** 가 들어있다. 도메인 엔드포인트는 URL 에 churchId 를 받지 않고 토큰의 churchId 로만 스코프된다.',
  '- 활성 교회가 없으면(`POST /auth/select-church` 미수행) 해당 엔드포인트는 403 을 던진다.',
  '',
  '### 권한 (역할 → 권한)',
  '- `owner`, `admin`: 전 권한 (재정 쓰기, 팀 관리 포함)',
  '- `staff`: 교인·출석·목양·일정·갤러리·기준정보·간사·선교사 쓰기 + 전 읽기 (재정 쓰기/팀 관리 제외)',
  '- `shepherd`(간사): 교인·출석·훈련·양육기록·일정·갤러리 쓰기 + 전 읽기. 기준정보·간사·선교사 관리는 읽기만',
  '- `viewer`: 읽기 전용, 단 목양기록(pastoral)은 민감정보라 읽기도 불가',
  '- 각 엔드포인트가 요구하는 권한은 아래 **403 응답 설명**에 적혀 있다.',
  '',
  '### 응답 규칙',
  '- 조회/생성/수정은 JSON, 삭제 계열은 204 No Content (본문 없음).',
  '- 엑셀·PDF·iCal 엔드포인트는 JSON 이 아니라 파일 바이너리를 반환한다.',
  '- 로컬 dev 에서는 prefix 없이(`/members`), production 에서는 `/api` prefix 로 서빙된다. 웹 dev 서버는 Vite 프록시가 `/api` 를 떼고 전달한다.',
].join('\n');

export async function setupSwagger(app: INestApplication): Promise<void> {
  const config = ConfigProvider;
  if (config.stage === 'production') {
    return;
  }
  const { version } = await import('../../../package.json');

  const builder = new DocumentBuilder()
    .setTitle('Yakirim 교회 관리 API')
    .setDescription(DESCRIPTION)
    .setVersion(version)
    // 실제 인증 수단. Swagger UI 는 브라우저 쿠키를 그대로 실어보낸다(withCredentials).
    .addCookieAuth(ACCESS_TOKEN_COOKIE, { type: 'apiKey', in: 'cookie', name: ACCESS_TOKEN_COOKIE }, ACCESS_TOKEN_COOKIE)
    // 쿠키를 쓸 수 없는 클라이언트(curl 등)용 — Authorization: Bearer <access token>
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token');

  SWAGGER_TAG_DESCRIPTIONS.forEach(tag => builder.addTag(tag.name, tag.description));

  const swaggerCustomOptions: SwaggerCustomOptions = {
    customSiteTitle: 'Yakirim API Docs',
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      // 태그만 먼저 보이게 접어두고, 정렬은 문서에 선언한 순서를 유지한다.
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  };

  const document = SwaggerModule.createDocument(app, builder.build());

  SwaggerModule.setup(SWAGGER_PATH, app, document, swaggerCustomOptions);
}
