// ============================================================
// 模型厂商 & 模型定义
// ============================================================

export type ProviderId = 'openai' | 'cloudflare' | 'yunwu';

export interface ModelOption {
  id: string;       // API model id
  label: string;    // 显示名称
  supports: ('chat' | 'image' | 'video')[];
}

export interface Provider {
  id: ProviderId;
  name: string;
  logo: string;
  baseUrl: string;
  models: ModelOption[];
}

// 视频生成模型（I2V - 图生视频）
export const VIDEO_MODELS: Record<string, string> = {
  'vidu-2.0': 'Vidu 2.0（⚡ 快）',
  'vidu-1.5': 'Vidu 1.5（⚡ 快）',
  'kling-v1-5': '可灵 v1.5',
  'kling-v2-0': '可灵 v2.0',
  'pika-2': 'Pika 2',
  'runway-gen3': 'Runway Gen3',
  'luma-photon': 'Luma Photon',
  'minimax-video': 'MiniMax 视频',
};

// Chat / GPT 模型（生成故事板）
export const CHAT_MODELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
  'deepseek-chat': 'DeepSeek Chat',
  'qwen-plus': '通义千问 Plus',
};

// 图像生成模型
export const IMAGE_MODELS: Record<string, string> = {
  'dall-e-3': 'DALL·E 3',
  'flux-schnell': 'FLUX Schnell',
  'flux-dev': 'FLUX Dev',
  'stable-diffusion-3': 'SD3',
};

export const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI 直连',
    logo: '🤖',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', supports: ['chat'] },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', supports: ['chat'] },
      { id: 'dall-e-3', label: 'DALL·E 3', supports: ['image'] },
    ],
  },
  {
    id: 'yunwu',
    name: '云雾 API',
    logo: '☁️',
    baseUrl: 'https://api.yunwu.ai',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o（故事板）', supports: ['chat'] },
      { id: 'vidu-2.0', label: 'Vidu 2.0（⚡ 快）', supports: ['video'] },
      { id: 'vidu-1.5', label: 'Vidu 1.5（⚡ 快）', supports: ['video'] },
      { id: 'kling-v1-5', label: '可灵 v1.5（视频）', supports: ['video'] },
      { id: 'kling-v2-0', label: '可灵 v2.0（视频）', supports: ['video'] },
      { id: 'pika-2', label: 'Pika 2（视频）', supports: ['video'] },
      { id: 'luma-photon', label: 'Luma Photon（视频）', supports: ['video'] },
      { id: 'runway-gen3', label: 'Runway Gen3（视频）', supports: ['video'] },
      { id: 'dall-e-3', label: 'DALL·E 3（图像）', supports: ['image'] },
      { id: 'flux-schnell', label: 'FLUX Schnell（图像）', supports: ['image'] },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    logo: '🌥️',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    models: [
      { id: '@cf/meta/llama-3-8b-instruct', label: 'Llama 3 8B（Chat）', supports: ['chat'] },
      { id: '@cf/meta/llama-3-70b-instruct', label: 'Llama 3 70B（Chat）', supports: ['chat'] },
      { id: '@cf/mistral/mistral-7b-instruct-v0.1', label: 'Mistral 7B（Chat）', supports: ['chat'] },
    ],
  },
];

/**
 * 根据 providerId + modelId 查找 Provider
 */
export function findProviderModel(providerId: ProviderId, modelId: string) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  const model = provider.models.find((m) => m.id === modelId);
  return model ? { provider, model } : null;
}

/**
 * 获取指定用途的模型列表
 */
export function getModelsForTask(
  providerId: ProviderId,
  task: 'chat' | 'image' | 'video'
): ModelOption[] {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];
  return provider.models.filter((m) => m.supports.includes(task));
}
