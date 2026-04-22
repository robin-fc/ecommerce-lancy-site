"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Wand2, Settings, Film, Play, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProviderSettings } from "@/components/provider-settings";
import type {
  Storyboard,
  Scene,
  AspectRatio,
  Resolution,
  VideoDuration,
  TransitionType,
  UserLLMConfig,
} from "@/lib/types";

// ============================================================
// 步骤定义（新顺序：上传 → 设置参数 → 输入创意 → 故事板预览 → 生成）
// ============================================================
const STEPS = [
  { id: 1, label: "上传图片", icon: Upload },
  { id: 2, label: "设置参数", icon: Settings },
  { id: 3, label: "输入创意", icon: Wand2 },
  { id: 4, label: "故事板预览", icon: Film },
  { id: 5, label: "生成视频", icon: Play },
];

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "9:16", label: "9:16 竖屏（抖音/TikTok）" },
  { value: "16:9", label: "16:9 横屏（YouTube/广告）" },
  { value: "1:1", label: "1:1 方形（Instagram）" },
];

const RESOLUTION_OPTIONS: { value: Resolution; label: string }[] = [
  { value: "720p", label: "720p（省成本）" },
  { value: "1080p", label: "1080p（高清推荐）" },
];

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: 5, label: "5 秒" },
  { value: 10, label: "10 秒" },
  { value: 15, label: "15 秒" },
  { value: 30, label: "30 秒" },
];

const TRANSITION_LABELS: Record<TransitionType, string> = {
  fade: "淡入淡出",
  dissolve: "叠化",
  wipe: "方向擦除",
  zoom: "缩放",
  none: "硬切",
};

// ============================================================
// 图片上传区
// ============================================================
function ImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      if (images.length + files.length > 9) {
        alert("最多上传 9 张图片");
        return;
      }

      setUploading(true);
      try {
        const newUrls: string[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("上传失败");
          const { publicUrl } = await res.json() as { publicUrl: string };

          newUrls.push(publicUrl);
        }
        onChange([...images, ...newUrls]);
      } catch (err) {
        console.error(err);
        alert("上传失败，请重试");
      } finally {
        setUploading(false);
      }
    },
    [images, onChange]
  );

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {images.map((url, i) => (
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-gray-50">
            <Image src={url} alt={`商品图 ${i + 1}`} fill className="object-cover" />
            <button
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5">
              图 {i + 1}
            </div>
          </div>
        ))}

        {images.length < 9 && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-xs text-gray-400">
              {uploading ? "上传中..." : `上传第 ${images.length + 1} 张`}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">最多 9 张，拖拽排序可调整分镜顺序</p>
    </div>
  );
}

// ============================================================
// 故事板预览（支持流式显示）
// ============================================================
function StoryboardPreview({
  storyboard,
  generating,
  generatingIndex,
  onConfirm,
}: {
  storyboard: Storyboard | null;
  generating: boolean;
  generatingIndex: number;
  onConfirm?: () => void;
}) {
  const scenes = storyboard?.scenes ?? [];
  const totalScenes = storyboard?.totalDuration ? Math.max(1, Math.round(storyboard.totalDuration / 5)) : 0;

  return (
    <div className="space-y-6">
      {storyboard && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{scenes.length} 个分镜{generating && ` / ${totalScenes}`}</h3>
            <p className="text-sm text-muted-foreground">
              时长 {storyboard.totalDuration}s · {storyboard.aspectRatio} · {storyboard.resolution}
            </p>
          </div>
          {!generating && onConfirm && (
            <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
              <Check className="w-4 h-4 mr-1" /> 确认生成视频
            </Button>
          )}
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          scenes.length <= 2 && "grid-cols-2",
          scenes.length > 2 && scenes.length <= 4 && "grid-cols-2",
          scenes.length > 4 && "grid-cols-3"
        )}
      >
        {scenes.map((scene, idx) => (
          <Card key={scene.id} className={cn("overflow-hidden", idx === generatingIndex && generating && "ring-2 ring-blue-400 animate-pulse")}>
            <div className="aspect-video bg-gray-100 relative">
              {scene.referenceImageUrl ? (
                <Image
                  src={scene.referenceImageUrl}
                  alt={scene.description}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                  {scene.order === 1 ? "首帧将以此图为基础" : "AI 生成中..."}
                </div>
              )}
              <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {scene.order}
              </div>
              <div className="absolute top-1 right-1 bg-white/90 text-xs px-1.5 py-0.5 rounded text-gray-700">
                {TRANSITION_LABELS[scene.transition]}
              </div>
            </div>
            <CardContent className="p-3">
              <p className="text-xs text-gray-600 leading-relaxed">{scene.description}</p>
              <details className="mt-2">
                <summary className="text-xs text-blue-500 cursor-pointer">查看 Prompt</summary>
                <p className="text-xs text-gray-400 mt-1 break-all">{scene.videoPrompt}</p>
              </details>
            </CardContent>
          </Card>
        ))}

        {/* 正在生成的占位符 */}
        {generating && generatingIndex >= scenes.length && (
          <Card className="overflow-hidden ring-2 ring-blue-300">
            <div className="aspect-video bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">正在生成分镜 {generatingIndex + 1}...</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {generating && (
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
          AI 正在构思故事，已生成 {scenes.length} / {totalScenes} 个分镜...
        </div>
      )}
    </div>
  );
}

// ============================================================
// 主页面
// ============================================================
export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [duration, setDuration] = useState<VideoDuration>(10);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [generatingSceneIndex, setGeneratingSceneIndex] = useState(-1);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [llmConfig, setLlmConfig] = useState<UserLLMConfig | undefined>(undefined);

  const [productName, setProductName] = useState("");
  // AI 帮写状态
  const [aiWriting, setAiWriting] = useState(false);

  // 根据时长计算分镜数
  const totalScenes = Math.max(1, Math.round(duration / 5));

  // AI 帮写创意描述
  const handleAiWrite = async () => {
    if (!llmConfig) {
      alert("请先配置模型厂商和 API Key");
      return;
    }
    if (!productName.trim() && images.length === 0) {
      alert("请先输入商品名称或上传商品图");
      return;
    }

    setAiWriting(true);
    try {
      const res = await fetch("/api/generate/creative-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageCount: images.length,
          duration,
          aspectRatio,
          llmConfig,
          productName: productName.trim(),
          hint: prompt.trim() || undefined,
        }),
      });

      const data = await res.json() as { prompt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI 帮写失败");

      setPrompt(data.prompt ?? "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "AI 帮写失败");
    } finally {
      setAiWriting(false);
    }
  };

  // 流式生成故事板
  const handleGenerateStoryboard = async () => {
    if (!llmConfig) {
      alert("请先配置模型厂商和 API Key");
      return;
    }

    setGeneratingStoryboard(true);
    setError(null);
    setStoryboard(null);
    setGeneratingSceneIndex(0);

    const scenes: Scene[] = [];
    let previousScene: { endFrameHint: string; videoPrompt: string } | undefined;

    try {
      for (let i = 0; i < totalScenes; i++) {
        setGeneratingSceneIndex(i);

        const res = await fetch("/api/generate/storyboard/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceImageUrls: images,
            userPrompt: prompt,
            totalDuration: duration,
            aspectRatio,
            sceneIndex: i,
            totalScenes,
            previousScene,
            llmConfig,
          }),
        });

        const data = await res.json() as { scene?: Scene; endFrameHint?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `分镜 ${i + 1} 生成失败`);

        const newScene: Scene = {
          ...data.scene!,
          referenceImageUrl: images[i % images.length] ?? images[0],
        };

        scenes.push(newScene);
        previousScene = {
          endFrameHint: data.endFrameHint || "",
          videoPrompt: newScene.videoPrompt,
        };

        // 更新故事板，实现逐个显示
        setStoryboard({
          id: `storyboard_${Date.now()}`,
          scenes: [...scenes],
          totalDuration: duration,
          aspectRatio,
          resolution,
          userPrompt: prompt,
        });
      }

      // 全部完成，进入预览
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGeneratingStoryboard(false);
      setGeneratingSceneIndex(-1);
    }
  };

  // 视频生成状态
  const [sceneJobIds, setSceneJobIds] = useState<string[]>([]);
  const [sceneResults, setSceneResults] = useState<{ sceneId: string; videoUrl?: string; error?: string }[]>([]);
  const [currentSceneJobId, setCurrentSceneJobId] = useState<string | null>(null);

  // 开始生成视频（逐个分镜处理）
  const handleStartGeneration = async () => {
    if (!storyboard || !llmConfig) return;
    setGenerating(true);
    setProgress(0);
    setStep(5);
    setError(null);
    setSceneResults([]);

    const results: { sceneId: string; videoUrl?: string; error?: string }[] = [];

    try {
      // 逐个处理分镜
      for (let i = 0; i < storyboard.scenes.length; i++) {
        const scene = storyboard.scenes[i];
        setProgress(Math.round((i / storyboard.scenes.length) * 100));

        // 调用分镜生成 API
        const res = await fetch("/api/generate/video/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene,
            llmConfig,
            aspectRatio: storyboard.aspectRatio,
            resolution: storyboard.resolution,
            totalScenes: storyboard.scenes.length,
            sceneIndex: i,
          }),
        });

        const data = await res.json() as { jobId?: string; sceneId?: string; status?: string; videoUrl?: string; error?: string };
        if (!res.ok || data.error) {
          results.push({ sceneId: scene.id, error: data.error ?? "启动失败" });
          continue;
        }

        // 同步模式：POST 直接返回视频 URL
        if (data.status === "done" && data.videoUrl) {
          results.push({ sceneId: scene.id, videoUrl: data.videoUrl });
          continue;
        }

        // 异步模式：需要轮询
        const jobId = data.jobId!;
        setSceneJobIds(prev => [...prev, jobId]);
        setCurrentSceneJobId(jobId);

        const videoUrl = await pollSceneJob(jobId);
        results.push({ sceneId: scene.id, videoUrl });
      }

      setSceneResults(results);

      // 所有分镜完成
      const successfulVideos = results.filter(r => r.videoUrl);
      if (successfulVideos.length > 1) {
        // 多个视频，调用合并 API
        setProgress(95);
        const videoUrls = successfulVideos.map(r => r.videoUrl!);
        
        try {
          const mergeRes = await fetch("/api/video/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrls }),
          });
          const mergeData = await mergeRes.json() as { mergedUrl?: string; fallback?: string; error?: string };
          
          if (mergeRes.ok && mergeData.mergedUrl) {
            setResultUrl(mergeData.mergedUrl);
          } else if (mergeData.fallback) {
            // FFmpeg 不可用，使用第一个视频
            setResultUrl(mergeData.fallback);
            setError("视频合并功能暂不可用，已返回第一个分镜视频");
          } else {
            setResultUrl(successfulVideos[0].videoUrl!);
            setError(mergeData.error || "视频合并失败");
          }
        } catch {
          // 合并失败，返回第一个视频
          setResultUrl(successfulVideos[0].videoUrl!);
          setError("视频合并失败，已返回第一个分镜视频");
        }
      } else if (successfulVideos.length === 1) {
        // 单个视频，直接使用
        setResultUrl(successfulVideos[0].videoUrl!);
      } else if (successfulVideos.length > 0) {
        // 部分成功
        setResultUrl(successfulVideos[0].videoUrl!);
        setError(`成功 ${successfulVideos.length}/${results.length} 个分镜`);
      } else {
        setError("所有分镜生成失败");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
      setCurrentSceneJobId(null);
    }
  };

  // 轮询单个分镜任务状态
  const pollSceneJob = async (jobId: string): Promise<string | undefined> => {
    const maxAttempts = 120; // 10 分钟超时
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/generate/video/scene?jobId=${jobId}`);
        const data = await res.json() as {
          status?: string;
          resultUrl?: string;
          progress?: number;
          currentStep?: string;
          error?: string;
        };

        if (data.status === "done" && data.resultUrl) {
          return data.resultUrl;
        }

        if (data.status === "failed") {
          throw new Error(data.error ?? "生成失败");
        }

        // 更新进度
        if (data.progress !== undefined) {
          setProgress(prev => Math.max(prev, data.progress!));
        }
      } catch (err) {
        if (err instanceof Error && err.message !== "生成失败") {
          // 网络错误，继续轮询
        } else {
          throw err;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error("超时");
  };

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto max-w-4xl px-4">
        {/* 顶部：模型配置状态 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {llmConfig ? (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                已配置 {llmConfig.providerId} · {llmConfig.chatModel}
              </span>
            ) : (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                请先配置模型厂商
              </span>
            )}
          </div>
          <ProviderSettings onSave={setLlmConfig} initialConfig={llmConfig} />
        </div>

        {/* 步骤条 */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => isDone && setStep(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                    isActive && "bg-blue-50 text-blue-600",
                    isDone && "text-green-600 hover:bg-green-50",
                    !isActive && !isDone && "text-gray-400"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("w-8 h-0.5", isDone ? "bg-green-400" : "bg-gray-200")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 内容 */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{STEPS[step - 1].label}</CardTitle>
            <CardDescription>
              {step === 1 && "上传商品参考图，AI 将基于这些图片生成创意分镜"}
              {step === 2 && "选择视频的技术规格"}
              {step === 3 && "描述你想要的视频创意，AI 将生成连贯的故事"}
              {step === 4 && "预览并确认 AI 生成的故事板"}
              {step === 5 && "视频生成中，请耐心等待..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: 上传图片 */}
            {step === 1 && <ImageUploader images={images} onChange={setImages} />}

            {/* Step 2: 设置参数 */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="mb-3 block">时长</Label>
                  <div className="flex gap-3">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                          duration === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {totalScenes} 个分镜
                  </p>
                </div>

                <div>
                  <Label className="mb-3 block">宽高比</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {ASPECT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAspectRatio(opt.value)}
                        className={cn(
                          "py-2.5 rounded-lg border text-sm font-medium transition-colors",
                          aspectRatio === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">清晰度</Label>
                  <div className="flex gap-3">
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setResolution(opt.value)}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                          resolution === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: 输入创意 */}
            {step === 3 && (
              <div className="space-y-4">
                {/* 商品名称（AI 帮写必需） */}
                <div>
                  <Label htmlFor="productName" className="mb-2 block">
                    商品名称
                    <span className="text-muted-foreground font-normal ml-1">（AI 帮写时需要知道推广什么商品）</span>
                  </Label>
                  <input
                    id="productName"
                    type="text"
                    placeholder="例如：XX品牌修身牛仔裤、某品牌运动鞋..."
                    className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="prompt">视频创意描述</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiWrite}
                      disabled={aiWriting || !llmConfig}
                      className="text-xs gap-1.5"
                    >
                      {aiWriting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI 创作中...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3" />
                          AI 帮写
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="prompt"
                    placeholder="例如：一只橘猫穿着潮牌卫衣，在赛博朋克风的城市街头走秀，路人纷纷回头注目，最后发现原来是一场时装秀..."
                    className="mt-2 min-h-[140px]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {prompt.trim()
                      ? `${prompt.trim().length} 字 · 点击「AI 帮写」可基于当前内容升级创意`
                      : "点击「AI 帮写」让 AI 自动脑洞创意，也可手动输入后让 AI 升级"}
                  </p>
                </div>

                {/* 实时显示参数摘要 */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1">将生成：</p>
                  <p className="text-muted-foreground">
                    {duration} 秒 · {totalScenes} 个分镜 · {aspectRatio} · {resolution}
                  </p>
                </div>

                <Button
                  onClick={handleGenerateStoryboard}
                  disabled={prompt.trim().length < 10 || generatingStoryboard || !llmConfig}
                  className="w-full"
                >
                  {generatingStoryboard ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI 构思中...
                    </>
                  ) : !llmConfig ? (
                    "请先配置模型厂商"
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      🎬 生成创意故事板
                    </>
                  )}
                </Button>

                {error && (
                  <div className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* 流式预览（在 Step 3 中也可以看到生成的分镜） */}
                {(generatingStoryboard || storyboard) && (
                  <div className="mt-4 pt-4 border-t">
                    <StoryboardPreview
                      storyboard={storyboard}
                      generating={generatingStoryboard}
                      generatingIndex={generatingSceneIndex}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: 故事板预览 */}
            {step === 4 && (
              <StoryboardPreview
                storyboard={storyboard}
                generating={false}
                generatingIndex={-1}
                onConfirm={handleStartGeneration}
              />
            )}

            {/* Step 5: 生成进度 */}
            {step === 5 && (
              <div className="text-center py-8 space-y-6">
                {resultUrl ? (
                  <div className="space-y-4">
                    <div className="text-4xl">🎉</div>
                    <h3 className="text-xl font-bold">视频生成完成！</h3>
                    <video src={resultUrl} controls className="w-full max-w-md mx-auto rounded-lg shadow-lg" />
                    <div className="flex gap-4 justify-center">
                      <Button asChild>
                        <a href={resultUrl} download>下载视频</a>
                      </Button>
                      <Button variant="outline" onClick={() => router.push("/")}>
                        再创作一个
                      </Button>
                    </div>
                  </div>
                ) : generating ? (
                  <div className="space-y-4">
                    <div className="text-4xl animate-pulse">🎬</div>
                    <h3 className="text-lg font-semibold">AI 正在生成中...</h3>
                    <div className="w-full max-w-md mx-auto bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">预计 1-3 分钟，请勿关闭页面</p>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <div className="text-4xl">😢</div>
                    <h3 className="text-lg font-semibold text-red-600">生成失败</h3>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button onClick={() => setStep(4)}>返回重试</Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">准备中...</p>
                )}
              </div>
            )}

            {/* 底部导航 */}
            {step < 5 && (
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
                  ← 上一步
                </Button>
                {step < 4 && (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={(step === 1 && images.length === 0)}
                  >
                    下一步 →
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
