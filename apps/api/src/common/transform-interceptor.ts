import { CallHandler, ExecutionContext, INestApplication, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { instanceToPlain } from 'class-transformer';

@Injectable()
class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(args => instanceToPlain(args)));
  }
}

export function setTransformInterceptor(app: INestApplication) {
  app.useGlobalInterceptors(new TransformInterceptor());
}
