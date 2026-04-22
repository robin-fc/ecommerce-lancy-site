import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/api-client";
import type { UserLLMConfig } from "@/lib/types";

// POST /api/generate/creative-prompt
// AI 帮写创意描述（泰国创意广告风格）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageCount = 0,
      duration = 10,
      aspectRatio = "9:16",
      llmConfig,
      hint = "",
      productName = "",
    } = body as {
      imageCount: number;
      duration: number;
      aspectRatio: string;
      llmConfig: UserLLMConfig;
      hint?: string;
      productName?: string;
    };

    if (!llmConfig?.apiKey || !llmConfig?.providerId) {
      return NextResponse.json({ error: "请先配置模型厂商和 API Key" }, { status: 400 });
    }

    const totalScenes = Math.max(1, Math.round(duration / 5));

    const productLine = productName
      ? `本广告推广的商品是：${productName}。这个商品必须在高潮/结尾出现，成为整支广告最令人印象深刻的"记忆锚点"。前面所有铺垫都服务于这个商品的出场。`
      : `${imageCount > 0 ? `用户提供了 ${imageCount} 张商品参考图，这些图片中的商品必须作为最终记忆锚点融入故事` : "故事中需要突出一个核心产品作为记忆锚点"}`;

    const systemPrompt = `你是一位享誉全球的泰国顶级创意广告导演，擅长打造让人过目不忘的病毒式广告短片。

你的创意风格特点：
1. 前半段用看似毫不相关的日常场景铺垫，制造强烈反差，让 viewer 产生困惑和好奇
2. 中段通过一个出人意料的转折点（plot twist），将叙事线急转弯
3. 结尾用一个与开篇呼应的镜头收束，让人恍然大悟、会心一笑甚至感动落泪
4. 全程穿插幽默、温情或荒诞元素，节奏紧凑不拖沓

关键规则：
- ${productLine}
- 如果有 ${totalScenes > 1 ? `${totalScenes} 个分镜` : "1 个分镜"}，分镜之间必须逻辑连贯、情绪递进，形成完整的叙事弧
- 创意必须脑洞大开，拒绝平淡和套路
- 商品出场方式要自然、巧妙，不能像硬广

分镜过渡技巧（必须体现在创意描述中）：
1. 情绪延续：每个分镜结尾的情绪/表情，要延续到下一分镜开头
2. 视觉延续：某个物体/角色在分镜间持续出现，形成视觉纽带
3. 动作延续：人物的连贯动作跨越分镜边界（如：跳起→落下）
4. 悬念延续：上一分镜结尾的疑问，在下一分镜给出答案
5. 声音延续：台词/音效不中断，延续到下一分镜

叙事结构建议：
- 悬念开场（前2秒）：反常现象/问题/疑问，让观众想看下去
- 铺垫发展（中间）：看似无关的日常，逐渐揭示关联
- 转折高潮（结尾前）：意外发现，剧情急转弯
- 升华收尾：与开篇呼应，情感落点，商品作为记忆锚点

请直接输出创意描述（纯文本，300-500 字），不要输出任何标题、序号、JSON 格式或额外说明。像在给导演口述镜头语言一样，画面感要强，每个分镜的衔接点要清晰描述。`;

    const userContent = hint
      ? `用户给了一个初步想法：${hint}\n\n请基于这个想法，发挥你的创意天赋，把它升级为一段让人拍案叫绝的泰国创意广告脚本描述。`
      : `请为一个 ${duration} 秒、${aspectRatio} 画面的广告短片构思一段创意描述。要求脑洞大开、反转惊喜、商品作为结尾记忆锚点。`;

    const creativePrompt = await chatCompletion(
      llmConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      llmConfig.chatModel
    );

    // 清理可能的 Markdown 包裹
    const cleaned = creativePrompt
      .replace(/^```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .replace(/^["'「『]|["'」』]$/g, "")
      .trim();

    return NextResponse.json({ prompt: cleaned });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    console.error("[/api/generate/creative-prompt]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
