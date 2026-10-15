import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { ConfigProvider } from '@src/config';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const { region, bucket, accessKeyId, secretAccessKey } = ConfigProvider.s3;
    this.bucket = bucket;
    this.client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  private assertConfigured() {
    const { bucket, accessKeyId, secretAccessKey } = ConfigProvider.s3;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException('S3 자격증명이 설정되지 않았습니다. (.envrc 의 AWS_* 확인)');
    }
  }

  buildKey(churchId: number, eventId: number, filename: string): string {
    const safe = filename.replace(/[^\w.\-가-힣]/g, '_').slice(0, 80);
    return `church/${churchId}/event/${eventId}/${randomUUID()}-${safe}`;
  }

  /** 업로드용 presigned PUT URL (5분). 클라이언트가 직접 S3 에 PUT. */
  async presignPut(key: string, contentType?: string): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: 300,
    });
  }

  /** 조회용 presigned GET URL (1시간). */
  async presignGet(key: string): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }

  /** 객체 삭제 (best effort). */
  async remove(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
