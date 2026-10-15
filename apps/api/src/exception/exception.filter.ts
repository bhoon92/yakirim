import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

export interface RequestExceptionResponse {
  status: number;
  code: number;
  message: string | string[];
  desc: string | string[];
  error: { reqId: string; code: string; desc: string[] };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const headers = ctx.getRequest().headers;
    const message = exception.toString();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    response.errorStack = exception.stack;
    if (exception instanceof HttpException) {
      let desc;
      const res = exception.getResponse() as RequestExceptionResponse;

      if (res.desc) {
        desc = Array.isArray(res.desc) ? res.desc : [res.desc];
      } else {
        desc = Array.isArray(res.message) ? res.message : [res.message];
      }

      return response.status(status).json({
        status: status,
        message: message,
        error: { reqId: headers.reqId, code: res.code || String(status), desc },
      });
    } else if (isUniqueViolation(exception)) {
      // 같은 이름 등 유니크 제약 위반은 서버 고장이 아니라 사용자가 고칠 수 있는 충돌이다.
      // 500 "예기치 못한 오류"로 보내면 원인을 알 수 없다 — 서비스마다 사전 검사를 다 하지 않아도 여기서 409 로 바꾼다.
      return response.status(HttpStatus.CONFLICT).json({
        status: HttpStatus.CONFLICT,
        message: '이미 같은 이름(값)이 있습니다.',
        error: { reqId: headers.reqId, code: String(HttpStatus.CONFLICT), desc: ['이미 같은 이름(값)이 있습니다.'] },
      });
    } else {
      console.error(exception);
      return response.status(status).json({
        status: status,
        message: message,
        error: {
          reqId: headers.reqId,
          code: '0000',
          desc: ['예기치 못한 오류가 발생했습니다.'],
        },
      });
    }
  }
}

/** Postgres unique_violation (23505). TypeORM 의 QueryFailedError 에 driverError.code 로 실려 온다. */
function isUniqueViolation(exception: unknown): boolean {
  const driverError = (exception as { driverError?: { code?: string } })?.driverError;
  return driverError?.code === '23505';
}
