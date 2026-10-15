import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

/** 공통 생성/수정(+삭제) 일시 컬럼 base. */
export class BaseDateEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

export class BaseDateEntityWithDeletedAt extends BaseDateEntity {
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
