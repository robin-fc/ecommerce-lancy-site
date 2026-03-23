// ============================================================
// 核心类型定义
// ============================================================

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
  status: 'pending' | 'generating_images' | 'generating_videos' | 'merging' | 'done' | 'failed';
  progress: number;           // 0-100
  currentStep: string;
  resultUrl?: string;         // 最终拼接后的视频 URL
  sceneResults: {
    sceneId: string;
    imageUrl?: string;
    videoUrl?: string;
  }[];
  error?: string;
  createdAt: string;
}

// API 请求/响应类型
export interface GenerateStoryboardRequest {
  referenceImageUrls: string[];
  userPrompt: string;
  totalDuration: VideoDuration;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  style?: VideoStyle;
}

export interface GenerateStoryboardResponse {
  storyboard: Storyboard;
}

export interface GenerateImageRequest {
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio: AspectRatio;
}

export interface GenerateVideoRequest {
  prompt: string;
  imageUrl: string;
  duration: VideoDuration;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}
