import { ArgumentsHost, ConflictException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './exception.filter';

function hostWith(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ headers: { reqId: 'r1' } }) }),
  } as unknown as ArgumentsHost;
}

function capture(exception: unknown) {
  const json = jest.fn();
  const response = { status: jest.fn((_code: number) => ({ json })), json };
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  new AllExceptionsFilter().catch(exception as never, hostWith(response));
  return { status: response.status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  // 한글 입력 후 Enter 로 저장 요청이 두 번 나가 두 번째가 유니크 제약에 걸렸을 때 500 "예기치 못한 오류"가 보였다 (9985055)
  it('Postgres 유니크 위반(23505)은 500 이 아니라 409 로 바꾼다', () => {
    const { status, body } = capture({ driverError: { code: '23505' }, toString: () => 'QueryFailedError' });
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.error.desc).toEqual(['이미 같은 이름(값)이 있습니다.']);
  });

  it('다른 DB 오류는 그대로 500', () => {
    const { status, body } = capture({ driverError: { code: '23503' }, toString: () => 'QueryFailedError' });
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.code).toBe('0000');
  });

  it('HttpException 은 상태와 메시지를 살린다', () => {
    const { status, body } = capture(new ConflictException('같은 이름의 기수가 있습니다.'));
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.error.desc).toEqual(['같은 이름의 기수가 있습니다.']);
  });
});
