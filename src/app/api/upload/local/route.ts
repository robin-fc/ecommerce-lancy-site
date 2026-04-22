import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// POST /api/upload/local
// 本地存储上传接口（开发环境用）
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const key = searchParams.get("key");
    const contentType = searchParams.get("contentType");

    if (!key) {
      return NextResponse.json({ error: "缺少 key 参数" }, { status: 400 });
    }

    // 确保 uploads 目录存在
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 读取请求体（文件内容）
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 写入文件
    const filename = key.replace("uploads/", "");
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const publicUrl = `/uploads/${filename}`;
    return NextResponse.json({ success: true, publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/upload/local]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
