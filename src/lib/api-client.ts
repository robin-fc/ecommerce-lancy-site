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
  method: 'POST' | 'GET' = 'POST',
): Promise<T> {
  const baseUrl = config.baseUrl ?? 'https://api.yunwu.ai';
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
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

// 模型 ID 映射：前端友好名 → Vidu API 模型名
const VIDU_MODEL_MAP: Record<string, string> = {
  'vidu-2.0': 'viduq2-pro',   // 实际可用名
  'vidu-1.5': 'viduq1',
};

export async function generateVideo(
  config: UserLLMConfig,
  prompt: string,
  imageUrl: string,
  duration: number = 5,
  aspectRatio: AspectRatio = '16:9',
  resolution: Resolution = '720p',
  model?: string,
  callbackUrl?: string,
): Promise<VideoResult> {
  const apiModel = VIDU_MODEL_MAP[model ?? ''] ?? 'viduq2';

  // 云雾 Vidu 端点：POST /ent/v2/img2video
  // 支持 callback_url，任务完成时 Vidu 主动推送通知
  const body: Record<string, unknown> = {
    model: apiModel,
    images: [imageUrl],
    prompt,
    duration: duration > 4 ? 8 : 4,
  };
  if (callbackUrl) {
    body.callback_url = callbackUrl;
  }

  const result = await yunwuRequest<{
    task_id?: string;
    job_id?: string;
    state?: string;
    creations?: { url?: string }[];
    url?: string;
    message?: string;
  }>(config, '/ent/v2/img2video', {
    model: apiModel,
    images: [imageUrl],
    prompt,
    duration: duration > 4 ? 8 : 4,
  });

  // 同步完成：直接返回视频 URL
  if (result.state === 'success' || result.creations?.[0]?.url) {
    return {
      videoUrl: result.creations?.[0]?.url ?? result.url ?? '',
      duration,
    };
  }

  // 异步模式：返回 task_id 供后续轮询
  const taskId = result.task_id || result.job_id;
  if (taskId) {
    return { videoUrl: '', duration, jobId: taskId };
  }

  throw new Error(`视频生成响应格式未知: ${JSON.stringify(result)}`);
}

// ============================================================
// 查询视频任务状态（云雾 Vidu 异步模式）
// ============================================================
export async function queryVideoJob(
  config: UserLLMConfig,
  taskId: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  // 云雾 Vidu 状态查询正确端点：GET /ent/v2/tasks/{taskId}/creations
  // 实测响应格式：
  // {
  //   "task_id": "944462596658962432",
  //   "state": "success",            // created / processing / success / failed
  //   "progress": 100,
  //   "creations": [{ "id": "...", "url": "https://...", "cover_url": "https://..." }]
  // }
  const result = await yunwuRequest<{
    state?: string;
    status?: string;
    error_msg?: string;
    message?: string;
    creations?: { url?: string; cover_url?: string }[];
    video_url?: string;
    url?: string;
  }>(config, `/ent/v2/tasks/${taskId}/creations`, {}, 'GET');

  const state = result.state ?? result.status;

  if (state === 'success' || state === 'completed') {
    const videoUrl = result.creations?.[0]?.url ?? result.video_url ?? result.url;
    return { status: 'completed', videoUrl };
  }
  if (state === 'failed') {
    return { status: 'failed', error: result.error_msg ?? result.message };
  }
  // created / processing / pending 都当处理中
  return { status: 'processing' };
}

// ============================================================
// 兼容旧版（逐步废弃）
// ============================================================
export { generateImage as yunwuGenerateImage };
