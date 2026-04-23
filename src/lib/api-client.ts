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
  provider?: 'vidu' | 'kling';
}

// 模型 ID 映射：前端友好名 → API 模型名
const VIDU_MODEL_MAP: Record<string, string> = {
  'vidu-2.0': 'viduq2-pro',
  'vidu-1.5': 'viduq1',
};

// 可灵模型名称
const KLING_MODELS = ['kling-v1-5', 'kling-v2-0', 'kling-v2-1', 'kling-v2-5', 'kling-v3'];

// 判断是否为可灵模型
function isKlingModel(model?: string): boolean {
  if (!model) return false;
  const normalized = model.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return KLING_MODELS.some(k => normalized.includes(k.replace(/[^a-z0-9-]/g, '')));
}

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
  // 可灵模型使用单独的 API 端点
  if (isKlingModel(model)) {
    return generateKlingVideo(config, prompt, imageUrl, duration, aspectRatio, model, callbackUrl);
  }

  // Vidu 模型
  return generateViduVideo(config, prompt, imageUrl, duration, model, callbackUrl);
}

// 可灵视频生成
async function generateKlingVideo(
  config: UserLLMConfig,
  prompt: string,
  imageUrl: string,
  duration: number,
  aspectRatio: AspectRatio,
  model?: string,
  callbackUrl?: string,
): Promise<VideoResult> {
  const klingModelMap: Record<string, string> = {
    'kling-v1-5': 'kling-v1-5',
    'kling-v2-0': 'kling-v2-master',
    'kling-v2-1': 'kling-v2-1',
    'kling-v2-5': 'kling-v2-5-turbo',
    'kling-v3': 'kling-v3',
  };
  const apiModel = klingModelMap[model ?? ''] ?? 'kling-v2-master';

  const body: Record<string, unknown> = {
    model_name: apiModel,
    image: imageUrl,
    prompt,
    duration,
    cfg_scale: 0.5,
    mode: 'std',
  };
  if (callbackUrl) {
    body.callback_url = callbackUrl;
  }

  const result = await yunwuRequest<{
    data?: { task_id?: string; task_status?: string };
    task_id?: string;
    code?: number;
    message?: string;
  }>(config, '/kling/v1/videos/image2video', body);

  const taskId = result.data?.task_id || result.task_id;
  if (taskId) {
    return { videoUrl: '', duration, jobId: taskId, provider: 'kling' };
  }

  throw new Error(`可灵视频生成失败: ${result.message ?? JSON.stringify(result)}`);
}

// Vidu 视频生成
async function generateViduVideo(
  config: UserLLMConfig,
  prompt: string,
  imageUrl: string,
  duration: number,
  model?: string,
  callbackUrl?: string,
): Promise<VideoResult> {
  const apiModel = VIDU_MODEL_MAP[model ?? ''] ?? 'viduq2';

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
  }>(config, '/ent/v2/img2video', body);

  if (result.state === 'success' || result.creations?.[0]?.url) {
    return { videoUrl: result.creations?.[0]?.url ?? result.url ?? '', duration };
  }

  const taskId = result.task_id || result.job_id;
  if (taskId) {
    return { videoUrl: '', duration, jobId: taskId, provider: 'vidu' };
  }

  throw new Error(`Vidu 视频生成响应格式未知: ${JSON.stringify(result)}`);
}

// ============================================================
// 查询视频任务状态（云雾 Vidu / 可灵 异步模式）
// ============================================================
export async function queryVideoJob(
  config: UserLLMConfig,
  taskId: string,
  provider: 'vidu' | 'kling' = 'vidu',
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  // 可灵状态查询
  if (provider === 'kling') {
    return queryKlingJob(config, taskId);
  }

  // Vidu 状态查询
  return queryViduJob(config, taskId);
}

// 可灵任务查询
async function queryKlingJob(
  config: UserLLMConfig,
  taskId: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  const result = await yunwuRequest<{
    data?: {
      task_status?: string;
      task_status_msg?: string;
      task_result?: {
        videos?: { url?: string; id?: string }[];
      };
    };
    code?: number;
    message?: string;
  }>(config, `/kling/v1/videos/image2video/${taskId}`, {}, 'GET');

  const status = result.data?.task_status?.toLowerCase();

  if (status === 'succeed' || status === 'success') {
    const videoUrl = result.data?.task_result?.videos?.[0]?.url;
    return { status: 'completed', videoUrl };
  }
  if (status === 'failed') {
    return { status: 'failed', error: result.data?.task_status_msg ?? result.message };
  }
  // submitted / processing
  return { status: 'processing' };
}

// Vidu 任务查询
async function queryViduJob(
  config: UserLLMConfig,
  taskId: string,
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
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
  return { status: 'processing' };
}

// ============================================================
// 兼容旧版（逐步废弃）
// ============================================================
export { generateImage as yunwuGenerateImage };
