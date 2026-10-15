import { HttpException } from '@nestjs/common';
import { ExceptionMessage } from '@src/exception/exception.enum';
import { ExceptionDetail, ExceptionType } from '@src/exception/exception.type';

export class Exception extends HttpException {
  constructor(exceptionMessage: ExceptionMessage, message?: string, exception?: HttpException) {
    const exceptionType = ExceptionDetail[exceptionMessage] as ExceptionType;
    super(
      { code: exceptionMessage, desc: message ?? exceptionType.message },
      exception?.getStatus() ?? exceptionType.httpException.getStatus()
    );
  }

  // catch에서 받은 에러를 Exception로 변환하여 throw
  static reThrowError(exceptionMessage: ExceptionMessage, message?: string, exception?: HttpException) {
    return (e: Error) => {
      if (e instanceof Exception) {
        throw e;
      }
      console.error(e);
      throw new Exception(exceptionMessage, message, exception);
    };
  }
}
