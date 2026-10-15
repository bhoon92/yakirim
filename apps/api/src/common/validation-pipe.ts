import { ArgumentMetadata, INestApplication, ValidationPipe } from '@nestjs/common';

class CustomizedGlobalValidationPipe extends ValidationPipe {
  constructor() {
    super({ whitelist: true, forbidNonWhitelisted: false, transform: true });
  }
  // CustomDecorator는 모두 CustomDecorator에서 동작하도록
  transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (metadata.type === 'custom') {
      return value;
    }
    return super.transform(value, metadata);
  }
}

// whiteList -> 엔티티 데코레이터에 없는 프로퍼티 값은 무조건 거름
// forbidNonWhitelisted -> 엔티티 데코레이터에 없는 값 인입시 그 값에 대한 에러메세지 알려줌
// transform -> 컨트롤러가 값을 받을때 컨트롤러에 정의한 타입으로 형변환
export function setValidationPipe(app: INestApplication) {
  app.useGlobalPipes(new CustomizedGlobalValidationPipe());
}
