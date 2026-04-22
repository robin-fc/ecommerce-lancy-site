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
 * 生成完整的故事板 Prompt（强调剧情连贯性）
 */
export function buildStoryboardPrompt(params: {
  referenceImageDescriptions: string[];
  userPrompt: string;
  totalDuration: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}): string {
  const { referenceImageDescriptions, userPrompt, totalDuration, aspectRatio, resolution } = params;

  // 根据时长自动决定分镜数量：每段5-10秒
  const numScenes = Math.max(1, Math.round(totalDuration / 5));

  const refImagesSection = referenceImageDescriptions.length > 0
    ? `## 商品参考图
用户上传了 ${referenceImageDescriptions.length} 张商品参考图，请按顺序在每个分镜中使用：
${referenceImageDescriptions.map((desc, i) => `  [图${i + 1}]: ${desc || '商品图片'}`).join('\n')}
`
    : '';

  return `你是一位顶级广告创意导演，擅长讲故事、制造反转、创造记忆点。你的任务是创作一个完整的微电影故事。

## 任务
根据用户的创意方向，创作一个 ${totalDuration} 秒的**连贯故事**，拆分为 ${numScenes} 个分镜。

${refImagesSection}
## 用户创意方向
"${userPrompt}"

## 技术规格
- 宽高比: ${aspectRatio}
- 分辨率: ${resolution}
- 单段时长: 约 ${Math.round(totalDuration / numScenes)} 秒

## ⚠️ 关键要求：故事连贯性

**你必须创作一个完整、连贯的故事，而非独立分镜的拼接！**

### 剧情结构（遵循经典叙事）：
1. **开场（分镜1）**：建立场景，引入主角/商品，制造悬念或吸引力
2. **发展（分镜2~N-1）**：推进剧情，每个分镜的**结束画面**必须是下一个分镜的**起始画面**
3. **高潮/结尾（分镜N）**：反转、点睛、品牌记忆

### 画面衔接规则：
- 分镜 N 的最后一个画面 → 分镜 N+1 的第一个画面，必须有**视觉连续性**
- 例如：分镜1结束是"猫咪跳跃到空中" → 分镜2开始就是"猫咪落地"
- 例如：分镜2结束是"商品特写" → 分镜3开始就是"从商品拉远展示场景"
- 转场效果服务于剧情，而非掩盖割裂

### Prompt 编写规则：
- **videoPrompt** 必须明确描述：起始状态 → 动作/变化 → 结束状态
- 结束状态要与下一个分镜的起始状态呼应
- 商品始终是视觉焦点，但可以以创意方式呈现

## 转场类型选择
- fade: 淡入淡出，情绪过渡
- dissolve: 叠化，时间流逝/梦幻
- wipe: 方向擦除，快节奏切换
- zoom: 缩放，聚焦/拉远
- none: 硬切，瞬间切换

## 输出格式（严格 JSON，不要有注释）
{
  "storyTitle": "故事标题（2-6个字）",
  "storySummary": "一句话概括整个故事",
  "scenes": [
    {
      "id": "scene_1",
      "order": 1,
      "description": "【分镜1】中文描述：场景、动作、情绪、商品如何呈现（2-3句话）",
      "startFrameHint": "起始画面：描述这个分镜开始时的画面状态",
      "endFrameHint": "结束画面：描述这个分镜结束时的画面状态（要能衔接下一分镜）",
      "imagePrompt": "英文图像 Prompt，${ASPECT_HINTS[aspectRatio]}，描述关键帧画面",
      "videoPrompt": "英文视频 Prompt：起始状态 → 动作过程 → 结束状态，包含摄像机运动",
      "transition": "fade|dissolve|wipe|zoom|none",
      "referenceImageUrl": ${referenceImageDescriptions.length > 0 ? '"$INDEX:0"' : 'null'}
    }
  ],
  "totalDuration": ${totalDuration}
}

现在请创作一个完整的、画面连贯的故事：`;
}

/**
 * 生成单个分镜的 Prompt（用于流式生成）
 */
export function buildScenePrompt(params: {
  referenceImageDescriptions: string[];
  userPrompt: string;
  totalDuration: number;
  aspectRatio: AspectRatio;
  sceneIndex: number;
  totalScenes: number;
  previousScene?: {
    endFrameHint: string;
    videoPrompt: string;
  };
}): string {
  const { referenceImageDescriptions, userPrompt, totalDuration, aspectRatio, sceneIndex, totalScenes, previousScene } = params;

  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex === totalScenes - 1;
  const sceneDuration = Math.round(totalDuration / totalScenes);

  let roleGuidance = '';
  if (isFirst) {
    roleGuidance = '你是开场导演。建立场景，引入主角/商品，制造吸引力或悬念。让观众想看下去。';
  } else if (isLast) {
    roleGuidance = '你是结尾导演。给出反转、点睛、或品牌记忆点。让观众记住这个故事。';
  } else {
    roleGuidance = '你是剧情推进导演。承接上一分镜的结束画面，推进故事发展。';
  }

  const continuitySection = previousScene
    ? `
## 上一分镜的结束画面（你的起始画面必须与此衔接）
"${previousScene.endFrameHint}"
上一分镜的视频 Prompt：${previousScene.videoPrompt}
`
    : '';

  const refImageSection = referenceImageDescriptions.length > 0
    ? `\n## 商品参考图\n${referenceImageDescriptions.map((d, i) => `[图${i + 1}]: ${d}`).join('\n')}\n`
    : '';

  return `${roleGuidance}

## 任务
生成分镜 ${sceneIndex + 1} / ${totalScenes}，时长约 ${sceneDuration} 秒。
${continuitySection}
## 用户创意方向
"${userPrompt}"
${refImageSection}
## 技术规格
- 宽高比: ${aspectRatio}
- 这是一段连贯故事的第 ${sceneIndex + 1} 个镜头

## 输出格式（严格 JSON，单行）
{"id":"scene_${sceneIndex + 1}","order":${sceneIndex + 1},"description":"中文描述（2-3句话）","startFrameHint":"起始画面状态","endFrameHint":"结束画面状态（要能衔接下一分镜）","imagePrompt":"英文图像Prompt","videoPrompt":"英文视频Prompt：起始→动作→结束","transition":"fade|dissolve|wipe|zoom|none"}

${isLast ? '这是最后一个分镜，给出精彩结尾！' : '记住：你的结束画面要能让下一个分镜自然衔接。'}
只输出 JSON，不要有其他内容。`;
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

/**
 * 解析单个分镜 JSON
 */
export function parseSceneResponse(raw: string) {
  const match = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*?\})/);
  const jsonStr = match ? match[1] : raw;

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Scene parse error:', e, 'Raw:', raw.substring(0, 200));
    throw new Error('分镜解析失败');
  }
}
