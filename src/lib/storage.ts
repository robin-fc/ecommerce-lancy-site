// ============================================================
// 文件存储封装（开发环境用本地存储，生产环境用 R2）
// ============================================================

import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 本地存储目录
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

/**
 * 确保上传目录存在
 */
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * 检查是否配置了 R2
 */
function hasR2Config(): boolean {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  
  const configured = !!(
    accountId && 
    accessKey && 
    secretKey &&
    accountId !== 'your_r2_account_id' &&
    accessKey !== 'your_r2_access_key_id' &&
    secretKey !== 'your_r2_secret_access_key'
  );
  
  // 调试日志
  if (!configured) {
    console.log("[storage] R2 未配置，使用本地存储");
  }
  
  return configured;
}

/**
 * 保存文件，返回公开访问 URL
 * 开发环境：存到 public/uploads，直接通过 /uploads/xxx 访问
 * 生产环境：上传到 R2
 */
export async function saveFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  // 如果配置了 R2，使用 R2
  if (hasR2Config()) {
    const { uploadToR2 } = await import('./r2');
    return uploadToR2(key, body, contentType);
  }

  // 否则使用本地存储
  await ensureUploadDir();
  
  // key 格式: uploads/xxx.ext，提取文件名
  const filename = key.replace('uploads/', '');
  const filepath = join(UPLOAD_DIR, filename);
  
  await writeFile(filepath, Buffer.from(body));
  
  // 返回公开访问 URL（Next.js 会自动服务 public 目录）
  return `/uploads/${filename}`;
}

/**
 * 生成上传预签名 URL（R2）或直接上传 URL（本地）
 */
export async function createUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600,
): Promise<{ uploadUrl: string; publicUrl: string; method?: string }> {
  // 如果配置了 R2，使用 R2 预签名 URL
  if (hasR2Config()) {
    const { createUploadUrl: createR2UploadUrl } = await import('./r2');
    const uploadUrl = await createR2UploadUrl(key, contentType, expiresInSeconds);
    const publicUrl = `${process.env.R2_PUBLIC_URL ?? ''}/${key}`;
    return { uploadUrl, publicUrl };
  }

  // 本地存储：返回一个特殊的 URL，让客户端 POST 到 /api/upload/local
  await ensureUploadDir();
  const filename = key.replace('uploads/', '');
  const publicUrl = `/uploads/${filename}`;
  
  return {
    uploadUrl: `/api/upload/local?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`,
    publicUrl,
    method: 'POST', // 告诉客户端用 POST 而不是 PUT
  };
}
