"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Wand2, Settings, Film, Play, Check, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Storyboard, Scene, AspectRatio, Resolution, VideoDuration, TransitionType } from "@/lib/types";

// ============================================================
// 步骤定义
// ============================================================
const STEPS = [
  { id: 1, label: "上传图片", icon: Upload },
  { id: 2, label: "输入创意", icon: Wand2 },
  { id: 3, label: "设置参数", icon: Settings },
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
// 图片上传区组件
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
        // 每次上传一张，获取 R2 预签名 URL
        const newUrls: string[] = [];
        for (const file of files) {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          });
          const { uploadUrl, publicUrl } = await res.json();

          // 客户端直接 PUT 到 R2
          await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

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
      <p className="text-xs text-muted-foreground">最多 9 张，支持拖拽排序（决定分镜顺序）</p>
    </div>
  );
}

// ============================================================
// 故事板预览组件
// ============================================================
function StoryboardPreview({
  storyboard,
  onSceneUpdate,
  onConfirm,
}: {
  storyboard: Storyboard;
  onSceneUpdate?: (scenes: Scene[]) => void;
  onConfirm?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{storyboard.scenes.length} 个分镜</h3>
          <p className="text-sm text-muted-foreground">
            时长 {storyboard.totalDuration}s · {storyboard.aspectRatio} · {storyboard.resolution}
          </p>
        </div>
        {onConfirm && (
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
            <Check className="w-4 h-4 mr-1" /> 确认生成视频
          </Button>
        )}
      </div>

      {/* 四宫格预览 */}
      <div className={cn(
        "grid gap-3",
        storyboard.scenes.length <= 2 && "grid-cols-2",
        storyboard.scenes.length > 2 && storyboard.scenes.length <= 4 && "grid-cols-2",
        storyboard.scenes.length > 4 && "grid-cols-3",
      )}>
        {storyboard.scenes.map((scene) => (
          <Card key={scene.id} className="overflow-hidden">
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
              {onSceneUpdate && (
                <details className="mt-2">
                  <summary className="text-xs text-blue-500 cursor-pointer">查看 Prompt</summary>
                  <p className="text-xs text-gray-400 mt-1 break-all">{scene.videoPrompt}</p>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 主页面组件
// ============================================================
export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [duration, setDuration] = useState<VideoDuration>(10);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Step 1 校验
  const canGoFromStep1 = images.length > 0;
  const canGoFromStep2 = prompt.trim().length > 10;
  const canGoFromStep3 = aspectRatio && resolution && duration;

  // AI 生成故事板
  const handleGenerateStoryboard = async () => {
    setGeneratingPrompt(true);
    try {
      const res = await fetch("/api/generate/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrls: images,
          userPrompt: prompt,
          totalDuration: duration,
          aspectRatio,
          resolution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");

      // 将 referenceImageUrl 占位符替换为实际上传的图片 URL
      const scenes = data.storyboard.scenes.map((scene: Scene, idx: number) => ({
        ...scene,
        referenceImageUrl: images[idx % images.length] ?? images[0],
      }));

      setStoryboard({ ...data.storyboard, scenes });
      setStep(4);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      alert(`生成失败: ${message}`);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // 开始生成视频
  const handleStartGeneration = async () => {
    if (!storyboard) return;
    setGenerating(true);
    setProgress(0);
    setStep(5);

    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "启动失败");
      setJobId(data.jobId);

      // 轮询进度（简化版，Phase 2 改 WebSocket）
      pollProgress(data.jobId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      alert(`启动失败: ${message}`);
      setGenerating(false);
    }
  };

  const pollProgress = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        const data = await res.json();
        setProgress(data.progress ?? 0);

        if (data.status === "done") {
          setResultUrl(data.resultUrl);
          clearInterval(interval);
        } else if (data.status === "failed") {
          alert(`生成失败: ${data.error}`);
          clearInterval(interval);
          setGenerating(false);
        }
      } catch {
        // ignore
      }
    }, 3000);
  };

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto max-w-4xl px-4">
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
            <CardTitle>
              {STEPS[step - 1].label}
            </CardTitle>
            <CardDescription>
              {step === 1 && "上传商品参考图，AI 将基于这些图片生成创意分镜"}
              {step === 2 && "描述你想要的视频创意，或让 AI 帮你写"}
              {step === 3 && "选择视频的技术规格"}
              {step === 4 && "预览并确认 AI 生成的故事板，可手动调整"}
              {step === 5 && "视频生成中，请耐心等待..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: 上传图片 */}
            {step === 1 && (
              <ImageUploader images={images} onChange={setImages} />
            )}

            {/* Step 2: 输入创意 */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt">视频创意描述</Label>
                  <Textarea
                    id="prompt"
                    placeholder="例如：一只橘猫穿着潮牌卫衣，在赛博朋克风的城市街头走秀，路人纷纷回头注目..."
                    className="mt-2 min-h-[140px]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleGenerateStoryboard}
                  disabled={!canGoFromStep2 || generatingPrompt}
                  className="w-full"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {generatingPrompt ? "AI 构思中..." : "🎯 AI 帮我生成创意故事板"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  或者直接{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() => setStep(3)}
                  >
                    跳过，在分镜预览中编辑
                  </button>
                </p>
              </div>
            )}

            {/* Step 3: 设置参数 */}
            {step === 3 && (
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

            {/* Step 4: 故事板预览 */}
            {step === 4 && storyboard && (
              <>
                <StoryboardPreview
                  storyboard={storyboard}
                  onConfirm={handleStartGeneration}
                />
              </>
            )}

            {/* Step 5: 生成进度 */}
            {step === 5 && (
              <div className="text-center py-8 space-y-6">
                {resultUrl ? (
                  <div className="space-y-4">
                    <div className="text-4xl">🎉</div>
                    <h3 className="text-xl font-bold">视频生成完成！</h3>
                    <video
                      src={resultUrl}
                      controls
                      className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                    />
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
                ) : (
                  <p className="text-muted-foreground">准备中...</p>
                )}
              </div>
            )}

            {/* 底部导航 */}
            {step < 5 && (
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={step === 1}
                >
                  ← 上一步
                </Button>
                {step < 4 && (
                  <Button
                    onClick={() => {
                      if (step === 1 && !canGoFromStep1) return;
                      if (step === 3) {
                        // Step 3 → 4 需要先有 prompt（可以是空的）
                        setStep(4);
                        return;
                      }
                      setStep(step + 1);
                    }}
                    disabled={
                      (step === 1 && !canGoFromStep1) ||
                      (step === 3 && !canGoFromStep3)
                    }
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
