module.exports = {
  stage: 'production',
  cors: {
    // 웹·API 동일 도메인 서빙이므로 실질적으로 CORS 불필요.
    // 커스텀 도메인 연결 전까지 Railway URL 허용.
    origin: process.env.WEB_BASE_URL ? [process.env.WEB_BASE_URL] : [],
  },
  cookie: {
    isSecure: true,
    domain: [],
    prefix: '',
  },
};
