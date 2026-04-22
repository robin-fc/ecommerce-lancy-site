import { NextRequest, NextResponse } from "next/server";
import { saveFile } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

// POST /api/upload
// 接收 multipart/form-data 文件，服务端上传到 R2 或本地存储
// 返回：{ publicUrl }
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
    }

    // 生成唯一路径
    const ext = file.name.split(".").pop() ?? "bin";
    const key = `uploads/${Date.now()}-${uuidv4()}.${ext}`;

    // 服务端上传到 R2 或本地
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await saveFile(key, buffer, file.type);

    return NextResponse.json({ publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
