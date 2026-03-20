import { NextRequest, NextResponse } from "next/server";
import { buildStoryboardPrompt, parseStoryboardResponse } from "@/lib/prompts";
import { gptGenerateStoryboard } from "@/lib/yunwu";
import { v4 as uuidv4 } from "uuid";
import type { Storyboard } from "@/lib/types";

// POST /api/generate/storyboard
// 输入：referenceImageUrls + userPrompt + totalDuration + aspectRatio + resolution
// 输出：Storyboard JSON
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      referenceImageUrls = [],
      userPrompt,
      totalDuration = 10,
      aspectRatio = "16:9",
      resolution = "1080p",
    } = body;

    if (!userPrompt || userPrompt.trim().length < 5) {
      return NextResponse.json(
        { error: "创意描述太短，至少 5 个字" },
        { status: 400 }
      );
    }

    // 1. 构建 GPT Prompt
    const systemPrompt = `你是一个创意视频分镜设计师，输出严格 JSON 格式。`;
    const userContent = buildStoryboardPrompt({
      referenceImageDescriptions: referenceImageUrls.map((_: string, i: number) => `商品图片 ${i + 1}`),
      userPrompt,
      totalDuration,
      aspectRatio,
      resolution,
    });

    // 2. 调用 GPT-4o 生成故事板
    const rawResponse = await gptGenerateStoryboard(systemPrompt, userContent);

    // 3. 解析 JSON
    const parsed = parseStoryboardResponse(rawResponse);

    // 4. 包装成 Storyboard
    const storyboard: Storyboard = {
      id: uuidv4(),
      scenes: parsed.scenes.map((s: { id?: string; order?: number; description?: string; imagePrompt?: string; videoPrompt?: string; transition?: string; referenceImageUrl?: string }, i: number) => ({
        id: s.id ?? `scene_${i + 1}`,
        order: s.order ?? i + 1,
        description: s.description ?? "",
        imagePrompt: s.imagePrompt ?? "",
        videoPrompt: s.videoPrompt ?? s.imagePrompt ?? "",
        transition: (s.transition as "fade" | "dissolve" | "wipe" | "zoom" | "none") ?? "fade",
        referenceImageUrl: s.referenceImageUrl ?? referenceImageUrls[0],
      })),
      totalDuration,
      aspectRatio,
      resolution,
      userPrompt,
    };

    return NextResponse.json({ storyboard });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/generate/storyboard]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
