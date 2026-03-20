import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/yunwu";
import type { AspectRatio } from "@/lib/types";

// POST /api/generate/image
// 输入：prompt + referenceImageUrl + aspectRatio
// 输出：{ url }
export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceImageUrl, aspectRatio = "16:9" } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt 不能为空" }, { status: 400 });
    }

    const result = await generateImage(prompt, referenceImageUrl, aspectRatio as AspectRatio);

    return NextResponse.json({ url: result.url, revisedPrompt: result.revisedPrompt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/generate/image]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
