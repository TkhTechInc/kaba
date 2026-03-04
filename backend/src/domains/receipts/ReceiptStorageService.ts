import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReceiptStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    this.region = config?.get<string>('region') || process.env['AWS_REGION'] || 'af-south-1';
    this.s3 = new S3Client({ region: this.region });
    this.bucket = config?.get<string>('s3.receiptsBucket') || process.env['S3_RECEIPTS_BUCKET'] || '';
  }

  /** Generate presigned URL for client to upload receipt. */
  async getUploadUrl(
    businessId: string,
    contentType: string = 'image/jpeg',
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = `receipts/${businessId}/${uuidv4()}.jpg`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { uploadUrl, key };
  }

  /** Upload receipt PDF to S3 and return presigned download URL for WhatsApp sendMedia. */
  async uploadReceiptPdf(businessId: string, buffer: Buffer): Promise<{ key: string; url: string }> {
    const key = `receipts/${businessId}/pdfs/${uuidv4()}.pdf`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );
    const url = await this.getDownloadUrl(key);
    return { key, url };
  }

  /** Get presigned URL to read a stored receipt. */
  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  /** Fetch receipt from S3 as Buffer (for AI processing). */
  async getReceiptBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    const stream = response.Body;
    if (!stream) throw new Error('Empty S3 response');
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  isConfigured(): boolean {
    return !!this.bucket?.trim();
  }
}
