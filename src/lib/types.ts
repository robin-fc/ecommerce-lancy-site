// ============================================================
// 核心类型定义
// ============================================================

import type { ProviderId } from './providers';

export type TransitionType = 'fade' | 'dissolve' | 'wipe' | 'zoom' | 'none';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type Resolution = '720p' | '1080p';
export type VideoDuration = 5 | 10 | 15 | 30;
export type VideoStyle = 'thai_ads' | 'pet_battle' | 'short_drama' | 'custom';

export interface Scene {
  id: string;
  order: number;
  description: string;        // 场景中文描述
  imagePrompt: string;        // 图像生成 Prompt
  videoPrompt: string;        // 视频生成 Prompt（包含转场衔接指令）
  transition: TransitionType; // 切换到下一个场景的转场效果
  referenceImageUrl?: string; // 该分镜的参考图 URL（来自用户上传）
}

export interface Storyboard {
  id: string;
  scenes: Scene[];
  totalDuration: number;      // 秒
  aspectRatio: AspectRatio;
  resolution: Resolution;
  userPrompt: string;         // 用户的原始创意提示词
}

export interface GenerationJob {
  id: string;
  storyboardId: string;
  status: 'pending' | 'generating_image' | 'generating_video' | 'merging' | 'done' | 'failed';
  progress: number;           // 0-100
  currentStep: string;
  resultUrl?: string;         // 最终拼接后的视频 URL
  externalJobId?: string;     // 外部视频任务 ID（云雾等异步任务）
  videoProvider?: 'vidu' | 'kling'; // 视频生成提供商
  sceneResults: {
    sceneId: string;
    imageUrl?: string;
    videoUrl?: string;
  }[];
  error?: string;
  createdAt: string;
  // 用户 LLM 配置（序列化）
  llmConfig?: UserLLMConfig;
}

// 用户 LLM 配置
export interface UserLLMConfig {
  providerId: ProviderId;
  apiKey: string;
  baseUrl?: string;          // 自定义中转 base URL
  chatModel: string;         // 故事板生成模型
  imageModel?: string;        // 图像生成模型（可选）
  videoModel: string;         // 视频生成模型
}

// API 请求/响应类型
export interface GenerateStoryboardRequest {
  referenceImageUrls: string[];
  userPrompt: string;
  totalDuration: VideoDuration;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  style?: VideoStyle;
  // 用户 LLM 配置
  llmConfig: UserLLMConfig;
}

export interface GenerateStoryboardResponse {
  storyboard: Storyboard;
}

export interface GenerateImageRequest {
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
  llmConfig: UserLLMConfig;
}

export interface GenerateVideoRequest {
  prompt: string;
  imageUrl: string;
  duration: VideoDuration;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  llmConfig: UserLLMConfig;
}
