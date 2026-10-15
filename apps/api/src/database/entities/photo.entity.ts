import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../column-transformer';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 사진 — 행사(Event)에 속한 S3 객체 메타. */
@Entity('photo')
@Index(['churchId'])
@Index(['eventId'])
export class PhotoEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  eventId!: number;

  @Column({ comment: 'S3 object key' })
  s3Key!: string;

  @Column()
  originalName!: string;

  @Column({ nullable: true })
  contentType?: string;

  @Column({ type: 'bigint', transformer: bigintTransformer, nullable: true })
  size?: number;

  @Column({ comment: '업로더 account' })
  uploaderAccountId!: number;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;
}
