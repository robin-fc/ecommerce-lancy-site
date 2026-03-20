import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

// POST /api/upload
// 输入：{ filename, contentType }
// 输出：{ uploadUrl, publicUrl }
export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "缺少 filename 或 contentType" },
        { status: 400 }
      );
    }

    // 生成唯一路径
    const ext = filename.split(".").pop() ?? "bin";
    const key = `uploads/${Date.now()}-${uuidv4()}.${ext}`;

    // 生成预签名上传 URL（1小时有效期）
    const uploadUrl = await createUploadUrl(key, contentType, 3600);

    // 公开访问 URL（R2 public URL）
    const publicUrl = `${process.env.R2_PUBLIC_URL ?? ""}/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
