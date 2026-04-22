// ============================================================
// 通用 API Client - 支持用户自选厂商 + 自定义 API Key
// ============================================================

import type { ProviderId } from './providers';
import type { AspectRatio, Resolution } from './types';

const ASPECT_MAP: Record<AspectRatio, string> = {
  '9:16': '576:1024',
  '16:9': '1024:576',
  '1:1': '1024:1024',
};

const RESOLUTION_MAP: Record<Resolution, string> = {
  '720p': '720p',
  '1080p': '1080p',
};

export interface UserLLMConfig {
  providerId: ProviderId;
  apiKey: string;
  baseUrl?: string;
  chatModel?: string;
  imageModel?: string;
  videoModel?: string;
}

// ============================================================
// 通用请求（云雾兼容）
// ============================================================
async function yunwuRequest<T = unknown>(
  config: UserLLMConfig,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const baseUrl = config.baseUrl ?? 'https://api.yunwu.ai';
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = await res.json() as { error?: { message?: string }; message?: string };
      msg = json.error?.message ?? json.message ?? msg;
    } catch {
      msg = await res.text() ?? msg;
    }
    throw new Error(`API 错误: ${msg}`);
  }

  return res.json() as Promise<T>;
}

// ============================================================
// Chat / 故事板生成（OpenAI 兼容）
// ============================================================
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  config: UserLLMConfig,
  messages: ChatMessage[],
  model?: string,
): Promise<string> {
  const result = await yunwuRequest<{
    choices: { message: { content: string } }[];
  }>(config, '/v1/chat/completions', {
    model: model ?? config.chatModel ?? 'gpt-4o',
    messages,
    temperature: 0.8,
    max_tokens: 4000,
  });

  const content = result.choices[0]?.message?.content;
  if (!content) throw new Error('模型返回为空');
  return content;
}

// ============================================================
// 图像生成（文生图）- OpenAI 兼容格式
// ============================================================
export async function generateImage(
  config: UserLLMConfig,
  prompt: string,
  referenceImageUrl?: string,
  aspectRatio: AspectRatio = '16:9',
  model?: string,
): Promise<{ url: string; revisedPrompt?: string }> {
  const result = await yunwuRequest<{
    data: { url: string; revised_prompt?: string }[];
  }>(config, '/v1/images/generations', {
    model: model ?? config.imageModel ?? 'dall-e-3',
    prompt,
    n: 1,
    size: ASPECT_MAP[aspectRatio].replace(':', 'x'),
    ...(referenceImageUrl ? { reference_image: referenceImageUrl } : {}),
  });

  return {
    url: result.data[0].url,
    revisedPrompt: result.data[0].revised_prompt,
  };
}

// ============================================================
// 视频生成（图生视频 I2V）- 云雾 Vidu 专有端点
// ============================================================
export interface VideoResult {
  videoUrl: string;
  duration: number;
  jobId?: string;
}

export async function generateVideo(
  config: UserLLMConfig,
  prompt: string,
  imageUrl: string,
  duration: number = 5,
  aspectRatio: AspectRatio = '16:9',
  resolution: Resolution = '720p',
  _model?: string,
): Promise<VideoResult> {
  // 云雾 Vidu 2.0 正确端点：/ent/v2/img2video
  // 参考文档：https://yunwu.ai/pricing?provider=Vidu&category=音视频
  const result = await yunwuRequest<{
    job_id?: string;
    video_url?: string;
    url?: string;
    status?: string;
    message?: string;
  }>(config, '/ent/v2/img2video', {
    model: 'vidu2.0',
    image_url: imageUrl,
    prompt,
    duration: duration > 4 ? 8 : 4,
    resolution: RESOLUTION_MAP[resolution],
  });

  // 直接返回视频 URL（部分情况同步返回）
  if (result.video_url) {
    return { videoUrl: result.video_url, duration };
  }
  if (result.url) {
    return { videoUrl: result.url, duration };
  }

  // 异步模式：返回 job_id 供后续轮询
  if (result.job_id) {
    return { videoUrl: '', duration, jobId: result.job_id };
  }

  throw new Error(`视频生成响应格式未知: ${JSON.stringify(result)}`);
}

// ============================================================
// 查询视频任务状态（云雾 Vidu 异步模式）
// ============================================================
export async function queryVideoJob(
  config: UserLLMConfig,
  jobId: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  const result = await yunwuRequest<{
    status: string;
    video_url?: string;
    url?: string;
    error?: string;
    message?: string;
  }>(config, `/ent/v2/img2video/status/${jobId}`, {});

  if (result.status === 'completed' || result.status === 'succeed') {
    return {
      status: 'completed',
      videoUrl: result.video_url ?? result.url,
    };
  }
  if (result.status === 'failed') {
    return { status: 'failed', error: result.error ?? result.message };
  }

  return {
    status: result.status as 'pending' | 'processing',
    videoUrl: result.video_url ?? result.url,
  };
}

// ============================================================
// 兼容旧版（逐步废弃）
// ============================================================
export { generateImage as yunwuGenerateImage };
