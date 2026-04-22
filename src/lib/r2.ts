// ============================================================
// Cloudflare R2 存储封装（S3 兼容）
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'ecommerce-lancy-site';
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

/**
 * 上传文件到 R2，返回公开访问 URL
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  try {
    await R2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  } catch (err: unknown) {
    console.error("[R2] uploadToR2 error:", err);
    if (err instanceof Error) {
      throw new Error(`R2 上传失败: ${err.message}`);
    }
    throw err;
  }

  return `${PUBLIC_URL}/${key}`;
}

/**
 * 生成一个用于客户端上传的预签名 URL（PUT）
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(R2, command, { expiresIn: expiresInSeconds });
}

/**
 * 生成一个用于客户端读取的预签名 URL（GET）
 */
export async function createDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(R2, command, { expiresIn: expiresInSeconds });
}
