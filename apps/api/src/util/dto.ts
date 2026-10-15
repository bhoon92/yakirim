import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { inheritPropertyInitializers } from '@nestjs/mapped-types';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { Exclude, Expose, Type as TransformType } from 'class-transformer';
import { getMetadataStorage as getValidatorMetadataStorage } from 'class-validator';

const modelPropertiesAccessor = new ModelPropertiesAccessor();

export function PickDto<T, K extends keyof T>(classRef: Type<T>, keys: readonly K[]): Type<Pick<T, (typeof keys)[number]>> {
  const fields = modelPropertiesAccessor
    .getModelProperties(classRef.prototype)
    .filter(item => keys.includes(item as K))
    .map(item => item as K);

  return makeDecoratedDto(classRef, fields);
}

export function OmitDto<T, K extends keyof T>(classRef: Type<T>, keys: readonly K[]): Type<Omit<T, (typeof keys)[number]>> {
  const fields = modelPropertiesAccessor
    .getModelProperties(classRef.prototype)
    .filter(item => !keys.includes(item as K))
    .map(item => item as K);

  return makeDecoratedDto(classRef, fields) as unknown as Type<Omit<T, (typeof keys)[number]>>;
}

function makeDecoratedDto<T, K extends keyof T>(classRef: Type<T>, keys: readonly K[]): Type<Pick<T, (typeof keys)[number]>> {
  const isInheritedPredicate = (propertyKey: string) => keys.includes(propertyKey as unknown as K);

  @Exclude()
  abstract class PickTypeClass {
    constructor() {
      inheritPropertyInitializers(this, classRef, isInheritedPredicate);
    }
  }

  (keys as unknown as string[]).forEach(propertyKey => {
    // swagger 데코레이터 복사
    const metadata = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, classRef.prototype, propertyKey);
    const decoratorFactorySwagger = ApiProperty(metadata);
    decoratorFactorySwagger(PickTypeClass.prototype, propertyKey);

    const exposeDecoratorFactory = Expose();
    exposeDecoratorFactory(PickTypeClass.prototype, propertyKey);

    // Type용
    const reflectedType = Reflect.getMetadata('design:type', classRef.prototype, propertyKey);
    if (reflectedType) {
      const isClass = /^class/.test(reflectedType.toString());
      const typeDecoratorFactory = TransformType(isClass ? () => reflectedType : reflectedType);
      typeDecoratorFactory(PickTypeClass.prototype, propertyKey);
    }
  });

  // classValidator 데코레이터 복사
  const metadataStorage = getValidatorMetadataStorage();
  metadataStorage.getTargetValidationMetadatas(classRef, '', true, false).forEach(validationMetadata => {
    // 상속할 Field에만 적용
    if ((keys as unknown as string[]).includes(validationMetadata.propertyName)) {
      metadataStorage.addValidationMetadata({
        ...validationMetadata,
        target: PickTypeClass,
      });
    }
  });

  return PickTypeClass as Type<Pick<T, (typeof keys)[number]>>;
}
