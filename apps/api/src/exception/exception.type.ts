import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ExceptionMessage } from './exception.enum';

export interface ExceptionType {
  message: string | string[];
  httpException: HttpException;
}

export const ExceptionDetail: { [K in ExceptionMessage]?: ExceptionType } = {
  [ExceptionMessage.EXPIRED_TOKEN]: {
    message: '만료된 인증정보 입니다.',
    httpException: new UnauthorizedException(),
  },
};
