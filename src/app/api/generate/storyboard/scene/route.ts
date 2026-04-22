import { NextRequest, NextResponse } from "next/server";
import { buildScenePrompt, parseSceneResponse } from "@/lib/prompts";
import { chatCompletion } from "@/lib/api-client";
import type { Scene, UserLLMConfig } from "@/lib/types";

// POST /api/generate/storyboard/scene
// 流式生成单个分镜
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      referenceImageUrls = [],
      userPrompt,
      totalDuration = 10,
      aspectRatio = "16:9",
      sceneIndex = 0,
      totalScenes = 2,
      previousScene,
      llmConfig,
    } = body as {
      referenceImageUrls: string[];
      userPrompt: string;
      totalDuration: number;
      aspectRatio: string;
      sceneIndex: number;
      totalScenes: number;
      previousScene?: {
        endFrameHint: string;
        videoPrompt: string;
      };
      llmConfig: UserLLMConfig;
    };

    if (!llmConfig?.apiKey || !llmConfig?.providerId) {
      return NextResponse.json({ error: "请先配置模型厂商和 API Key" }, { status: 400 });
    }

    const systemPrompt = `你是专业的视频分镜设计师，输出严格 JSON 格式，不要有任何额外文字。`;
    const userContent = buildScenePrompt({
      referenceImageDescriptions: referenceImageUrls.map((_: string, i: number) => `商品图片 ${i + 1}`),
      userPrompt,
      totalDuration,
      aspectRatio: aspectRatio as "9:16" | "16:9" | "1:1",
      sceneIndex,
      totalScenes,
      previousScene,
    });

    const rawResponse = await chatCompletion(
      llmConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      llmConfig.chatModel
    );

    const parsed = parseSceneResponse(rawResponse);

    // 构造 Scene 对象
    const scene: Scene = {
      id: parsed.id || `scene_${sceneIndex + 1}`,
      order: parsed.order || sceneIndex + 1,
      description: parsed.description || "",
      imagePrompt: parsed.imagePrompt || "",
      videoPrompt: parsed.videoPrompt || parsed.imagePrompt || "",
      transition: parsed.transition || "fade",
      referenceImageUrl: referenceImageUrls[sceneIndex % referenceImageUrls.length] || referenceImageUrls[0],
    };

    // 返回分镜 + 结束画面提示（用于下一分镜衔接）
    return NextResponse.json({
      scene,
      endFrameHint: parsed.endFrameHint || "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/generate/storyboard/scene]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
