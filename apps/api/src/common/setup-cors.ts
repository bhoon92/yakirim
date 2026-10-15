import { ConfigProvider } from '@src/config';
import { INestApplication } from '@nestjs/common';

export function setupCors(app: INestApplication) {
  const config = ConfigProvider;

  app.enableCors({
    origin: config.cors.origin,
    credentials: true,
  });
}
