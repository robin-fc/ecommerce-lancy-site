import { NextRequest, NextResponse } from "next/server";
import { generateImage, generateVideo } from "@/lib/yunwu";
import { v4 as uuidv4 } from "uuid";
import { jobs } from "@/lib/jobs";
import type { Storyboard } from "@/lib/types";

// POST /api/generate/video
// 输入：Storyboard
// 输出：{ jobId }
export async function POST(req: NextRequest) {
  try {
    const { storyboard } = (await req.json()) as { storyboard: Storyboard };

    if (!storyboard || !storyboard.scenes?.length) {
      return NextResponse.json({ error: "无效的故事板" }, { status: 400 });
    }

    const jobId = uuidv4();

    // 创建任务
    const job: GenerationJob = {
      id: jobId,
      storyboardId: storyboard.id,
      status: "pending",
      progress: 0,
      currentStep: "等待处理",
      sceneResults: storyboard.scenes.map((s) => ({ sceneId: s.id })),
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);

    // 异步执行（不阻塞响应）
    processJob(jobId, storyboard).catch((err) => {
      console.error("Job failed:", err);
      const j = jobs.get(jobId);
      if (j) {
        j.status = "failed";
        j.error = err instanceof Error ? err.message : "未知错误";
      }
    });

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/jobs/[jobId] — 放在单独路由文件，这里用 NextResponse 动态路由
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
  const job = jobs.get(jobId);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json(job);
}

// ============================================================
// 后台处理逻辑
// ============================================================
async function processJob(jobId: string, storyboard: Storyboard) {
  const job = jobs.get(jobId)!;
  const { scenes, aspectRatio, resolution } = storyboard;

  try {
    // Phase 1: 单分镜 10s 简化版
    // 完整版：并行生成所有分镜的图和视频，然后 FFmpeg 拼接

    job.status = "generating_images";
    job.progress = 10;
    job.currentStep = "生成参考图...";

    // 1. 生成首帧参考图（使用第一张参考图或 AI 生成）
    const firstScene = scenes[0];
    let heroImageUrl = firstScene.referenceImageUrl;

    if (!heroImageUrl) {
      const imgResult = await generateImage(
        firstScene.imagePrompt,
        undefined,
        aspectRatio
      );
      heroImageUrl = imgResult.url;
    }

    job.progress = 30;
    job.currentStep = "生成视频中...";

    // 2. 生成视频片段（单段，Phase 2 扩展为多段拼接）
    const videoResult = await generateVideo(
      firstScene.videoPrompt,
      heroImageUrl,
      Math.min(storyboard.totalDuration, 10),
      aspectRatio,
      resolution
    );

    job.progress = 90;
    job.currentStep = "处理完成...";

    job.status = "done";
    job.progress = 100;
    job.resultUrl = videoResult.videoUrl;
    job.sceneResults[0] = {
      sceneId: firstScene.id,
      imageUrl: heroImageUrl,
      videoUrl: videoResult.videoUrl,
    };
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "生成失败";
  }
}


