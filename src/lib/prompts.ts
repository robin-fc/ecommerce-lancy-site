// ============================================================
// AI Prompt 模板 - 故事板生成
// ============================================================

import type { AspectRatio, Resolution, TransitionType } from './types';

// 转场描述中英对照
const TRANSITION_DESCRIPTIONS: Record<TransitionType, string> = {
  fade: '淡入淡出 (fade in/out)',
  dissolve: '叠化溶解 (cross dissolve)',
  wipe: '方向擦除 (wipe)',
  zoom: '缩放过渡 (zoom in/out)',
  none: '硬切 (cut)',
};

// 宽高比对应画面描述
const ASPECT_HINTS: Record<AspectRatio, string> = {
  '9:16': '竖屏全屏构图，强调中心主体，背景简洁',
  '16:9': '横屏电影感构图，有前景后景层次',
  '1:1': '方形构图，主体居中，背景纯净',
};

/**
 * 生成完整的故事板 Prompt
 */
export function buildStoryboardPrompt(params: {
  referenceImageDescriptions: string[]; // 用户上传图片的描述（从文件名/URL 提取或为空）
  userPrompt: string;
  totalDuration: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}): string {
  const { referenceImageDescriptions, userPrompt, totalDuration, aspectRatio, resolution } = params;

  // 根据时长自动决定分镜数量：每段5-10秒
  const numScenes = Math.max(1, Math.round(totalDuration / 5));

  const refImagesSection = referenceImageDescriptions.length > 0
    ? `## 商品参考图\n用户上传了 ${referenceImageDescriptions.length} 张商品参考图，请按顺序在每个分镜中使用：\n${referenceImageDescriptions.map((desc, i) => `  [图${i + 1}]: ${desc || '商品图片（请以创意方式呈现）'}`).join('\n')}\n`
    : '';

  return `你是一位顶级跨界广告创意导演，擅长泰国脑洞广告、萌宠大战、微短剧等创意视频。

## 任务
根据用户的创意方向，将 ${totalDuration} 秒的视频拆分为 ${numScenes} 个分镜，生成完整的故事板。

${refImagesSection}
## 用户创意方向
"${userPrompt}"

## 技术规格
- 宽高比: ${aspectRatio}
- 分辨率: ${resolution}
- 单段时长: 约 ${Math.round(totalDuration / numScenes)} 秒

## 分镜设计要求
1. **视觉锚点**: 每个分镜必须以商品为核心视觉元素，即使场景跨界夸张，也要让商品清晰可见
2. **转场衔接**: 相邻分镜之间要有视觉呼应（同色系/同主体/动势延续），确保转场自然
3. **创意跨界**: 鼓励脑洞创意（宠物 x 商品、动漫 x 现实、微短剧反转等）
4. **节奏感**: 开头要有吸引力（钩子），中间展开，最后有记忆点

## 转场类型选择（每个分镜结尾选一个）
- fade: 淡入淡出，最通用
- dissolve: 叠化，梦幻感
- wipe: 方向擦除，有动感
- zoom: 缩放，有冲击力
- none: 硬切，节奏感强

## 输出格式（严格 JSON）
{
  "scenes": [
    {
      "id": "scene_1",
      "order": 1,
      "description": "【分镜1】场景描述（2-3句话，描述人物动作、场景、商品如何呈现）",
      "imagePrompt": "英文图像生成 Prompt，${ASPECT_HINTS[aspectRatio]}，商品主体清晰，包含风格关键词",
      "videoPrompt": "英文视频生成 Prompt，在 imagePrompt 基础上添加动态描述 + 摄像机运动 + 背景元素",
      "transition": "fade|dissolve|wipe|zoom|none",
      "referenceImageUrl": ${referenceImageDescriptions.length > 0 ? '"$INDEX:' + (referenceImageDescriptions.length > 1 ? 'AUTO' : '0') + '"' : 'null'}
    }
  ],
  "totalDuration": ${totalDuration}
}

注意事项：
- imagePrompt 和 videoPrompt 全部使用英文
- 商品要在图像和视频 Prompt 中明确描述（颜色、形状、主要特征）
- 转场类型不要连续两个相同
- JSON 中不要包含任何注释`;
}

/**
 * 解析 GPT 返回的故事板 JSON
 */
export function parseStoryboardResponse(raw: string) {
  // 尝试提取 JSON block
  const match = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] : raw;

  try {
    const parsed = JSON.parse(jsonStr);
    // 验证结构
    if (!Array.isArray(parsed.scenes)) {
      throw new Error('Missing scenes array');
    }
    return parsed;
  } catch (e) {
    console.error('Storyboard parse error:', e);
    throw new Error('AI 返回格式错误，请重试');
  }
}
