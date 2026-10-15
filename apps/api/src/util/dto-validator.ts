import { applyDecorators } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { enumErrorMsg, maxNumberErrorMsg, minNumberErrorMsg, rangeErrorMsg, requiredErrorMsg, typeErrorMsg } from '@src/util/error-message';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

type ValidatorOptions = {
  required?: boolean;
  each?: boolean;
};

export function ParseNumber(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'ParseNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value === 'number') {
            return true;
          }
          const convertedValue = Number(value);
          // 이상하게 변경되는걸 방지하기 위해 문자열로 변환 후 비교
          if (!isNaN(convertedValue) && `${convertedValue}` === `${value}`) {
            (args.object as any)[propertyName] = convertedValue;
            return true;
          }
          return false;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${property}는 숫자여야 합니다.`;
        },
      },
    });
  };
}

function makeValidateDecoratorAsOptions(name: string, options?: ValidatorOptions): PropertyDecorator[] {
  const { required = true, each = false } = options ?? {};
  const decorators: PropertyDecorator[] = [];

  if (required) {
    decorators.push(IsDefined(requiredErrorMsg(name)));
  } else {
    decorators.push(IsOptional());
    decorators.push(ValidateIf(value => value !== null && value !== undefined));
  }
  if (each) {
    decorators.push(IsArray(typeErrorMsg(name, '배열')));
  }

  return decorators;
}

function validateArray(options?: ValidatorOptions) {
  const { each = false } = options ?? {};
  return { arrayType: each ? ' 배열' : '', each };
}

/** 문자열인 값 validator */
export function IsStringWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [...makeValidateDecoratorAsOptions(name, options), IsString({ ...typeErrorMsg(name, '문자열' + arrayType), each })];
  return applyDecorators(...decorators);
}

/** 숫자인 값 validator */
export function IsNumberWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    ParseNumber(name, { ...typeErrorMsg(name, '숫자' + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}

/** enum인 값 validator */
export function IsEnumWithError(name: string, enumType: any, options: ValidatorOptions = {}): PropertyDecorator {
  const { each } = validateArray(options);
  const decorators = [...makeValidateDecoratorAsOptions(name, options), IsEnum(enumType, { ...enumErrorMsg(name), each })];
  return applyDecorators(...decorators);
}

/** url인 값 validator */
export function IsUrlWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [...makeValidateDecoratorAsOptions(name, options), IsUrl({}, { ...typeErrorMsg(name, 'url' + arrayType), each })];
  return applyDecorators(...decorators);
}

/** boolean인 값 validator */
export function IsBooleanWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [...makeValidateDecoratorAsOptions(name, options), IsBoolean({ ...typeErrorMsg(name, '불리언' + arrayType), each })];
  return applyDecorators(...decorators);
}

/** 정규표현식에 맞는지 확인 validator */
export function MatchesWithError(name: string, regex: RegExp, format: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    Matches(regex, { ...typeErrorMsg(name, format + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}

/** 날짜인 값 validator */
export function IsDateStringWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    IsDateString({}, { ...typeErrorMsg(name, '날짜' + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}

/** 이메일인 값 validator */
export function IsEmailWithError(name: string, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [...makeValidateDecoratorAsOptions(name, options), IsEmail({}, { ...typeErrorMsg(name, '이메일' + arrayType), each })];
  return applyDecorators(...decorators);
}

/** 최솟값 validator */
export function IsMinWithError(name: string, min: number, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    Min(min, { ...minNumberErrorMsg(name + arrayType, min), each }),
    IsNumber({}, { ...typeErrorMsg(name, '숫자' + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}

/** 최댓값 validator */
export function IsMaxWithError(name: string, max: number, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    Max(max, { ...maxNumberErrorMsg(name + arrayType, max), each }),
    IsNumber({}, { ...typeErrorMsg(name, '숫자' + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}

/** 범위 지정 값 validator */
export function IsLengthWithError(name: string, min: number, max?: number, options: ValidatorOptions = {}): PropertyDecorator {
  const { arrayType, each } = validateArray(options);
  const decorators = [
    ...makeValidateDecoratorAsOptions(name, options),
    Length(min, max, { ...rangeErrorMsg(name + arrayType, min), each }),
    IsString({ ...typeErrorMsg(name, '문자열' + arrayType), each }),
  ];
  return applyDecorators(...decorators);
}
