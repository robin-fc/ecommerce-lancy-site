// ============================================================
// yunwu.ai API 封装
// yunwu.ai 是多模型 API gateway，支持 OpenAI 兼容格式
// ============================================================

import type { AspectRatio, Resolution } from './types';

const BASE_URL = process.env.YUNWU_BASE_URL ?? 'https://api.yunwu.ai/v1';
const API_KEY = process.env.YUNWU_API_KEY;

if (!API_KEY) {
  throw new Error('YUNWU_API_KEY is not set');
}

// 宽高比映射
const ASPECT_MAP: Record<AspectRatio, string> = {
  '9:16': '576x1024',
  '16:9': '1024x576',
  '1:1': '1024x1024',
};

const RESOLUTION_MAP: Record<Resolution, string> = {
  '720p': '720',
  '1080p': '1080',
};

/**
 * 通用请求封装
 */
async function yunwuRequest<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`yunwu.ai API error ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ============================================================
// 图像生成（调用 FLUX / DALL-E 等）
// ============================================================

export interface ImageGenerationResult {
  url: string;
  revisedPrompt?: string;
}

/**
 * 生成单张图像
 * @param prompt 英文图像生成 Prompt
 * @param referenceImageUrl 可选参考图（用于风格一致性）
 * @param aspectRatio 宽高比
 */
export async function generateImage(
  prompt: string,
  referenceImageUrl?: string,
  aspectRatio: AspectRatio = '16:9',
): Promise<ImageGenerationResult> {
  // yunwu.ai 的图像生成接口（OpenAI 兼容格式）
  const result = await yunwuRequest<{ data: { url: string; revised_prompt?: string }[] }>(
    '/images/generations',
    {
      model: 'dall-e-3', // 可选：flux-schnell / dall-e-3 / sd3
      prompt,
      n: 1,
      size: ASPECT_MAP[aspectRatio],
      reference_image: referenceImageUrl, // 如果 yunwu 支持参考图
    },
  );

  return {
    url: result.data[0].url,
    revisedPrompt: result.data[0].revised_prompt,
  };
}

// ============================================================
// 视频生成（调用 Runway / Pika / Kling / Luma 等）
// ============================================================

export interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
}

/**
 * 生成单个视频片段
 * @param prompt 英文视频生成 Prompt
 * @param imageUrl 起始参考图 URL（首帧）
 * @param duration 时长（秒）
 * @param aspectRatio 宽高比
 * @param resolution 清晰度
 */
export async function generateVideo(
  prompt: string,
  imageUrl: string,
  duration: number = 10,
  aspectRatio: AspectRatio = '16:9',
  resolution: Resolution = '1080p',
): Promise<VideoGenerationResult> {
  // yunwu.ai 视频生成接口
  // 不同模型有不同的接口，这里用通用格式
  const result = await yunwuRequest<{
    data: {
      video_url: string;
      duration?: number;
    };
  }>('/video/generations', {
    model: 'kling-v1-5', // 可选：runway-gen3 / pika-2 / kling-v1-5 / luma-photon
    prompt,
    image_url: imageUrl,
    duration: Math.min(duration, 10), // 单段最大 10s
    aspect_ratio: aspectRatio,
    resolution: RESOLUTION_MAP[resolution],
    // video_type 可选：text-to-video / image-to-video
  });

  return {
    videoUrl: result.data.video_url,
    duration: result.data.duration ?? duration,
  };
}

/**
 * 查询视频生成任务状态
 */
export async function queryVideoJob(jobId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  const result = await yunwuRequest<{
    status: string;
    video_url?: string;
    error?: string;
  }>(`/video/jobs/${jobId}`, {});

  return {
    status: result.status as 'pending' | 'processing' | 'completed' | 'failed',
    videoUrl: result.video_url,
    error: result.error,
  };
}

// ============================================================
// GPT-4o 生成故事板（via yunwu OpenAI 兼容接口）
// ============================================================

export interface StoryboardGPTMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function gptGenerateStoryboard(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const result = await yunwuRequest<{ choices: { message: { content: string } }[] }>(
    '/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    },
  );

  return result.choices[0].message.content;
}
