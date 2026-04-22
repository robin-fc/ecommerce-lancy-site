import { NextRequest, NextResponse } from "next/server";
import { generateImage, generateVideo, queryVideoJob } from "@/lib/api-client";
import { v4 as uuidv4 } from "uuid";
import { jobs } from "@/lib/jobs";
import type { Storyboard, GenerationJob, UserLLMConfig } from "@/lib/types";

// POST /api/generate/video
// 输入：{ storyboard, llmConfig }
// 输出：{ jobId }
export async function POST(req: NextRequest) {
  try {
    const { storyboard, llmConfig } = (await req.json()) as {
      storyboard: Storyboard;
      llmConfig: UserLLMConfig;
    };

    if (!storyboard || !storyboard.scenes?.length) {
      return NextResponse.json({ error: "无效的故事板" }, { status: 400 });
    }

    if (!llmConfig || !llmConfig.apiKey || !llmConfig.providerId) {
      return NextResponse.json({ error: "请先配置模型厂商和 API Key" }, { status: 400 });
    }

    const jobId = uuidv4();

    // 创建任务（保存用户 LLM 配置用于后续处理）
    const job: GenerationJob = {
      id: jobId,
      storyboardId: storyboard.id,
      status: "pending",
      progress: 0,
      currentStep: "等待处理",
      sceneResults: storyboard.scenes.map((s) => ({ sceneId: s.id })),
      createdAt: new Date().toISOString(),
      llmConfig,
    };
    jobs.set(jobId, job);

    // 异步执行（不阻塞响应）
    processJob(jobId, storyboard, llmConfig).catch((err) => {
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

// GET /api/generate/video — 查询 job 状态
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
async function processJob(
  jobId: string,
  storyboard: Storyboard,
  llmConfig: UserLLMConfig,
) {
  const job = jobs.get(jobId)!;
  const { scenes, aspectRatio, resolution } = storyboard;

  try {
    job.status = "generating_image";
    job.progress = 10;
    job.currentStep = "生成参考图...";

    // 1. 生成首帧参考图（使用用户上传图或 AI 生成）
    const firstScene = scenes[0];
    let heroImageUrl = firstScene.referenceImageUrl;

    if (!heroImageUrl && llmConfig.imageModel) {
      const imgResult = await generateImage(
        llmConfig,
        firstScene.imagePrompt,
        undefined,
        aspectRatio
      );
      heroImageUrl = imgResult.url;
    }

    if (!heroImageUrl) {
      // 没有参考图，也没有配置图像模型：直接跳到视频生成
      heroImageUrl = scenes.find((s) => s.referenceImageUrl)?.referenceImageUrl ?? "";
    }

    job.progress = 30;
    job.currentStep = "生成视频中...";
    job.status = "generating_video";

    // 2. 生成视频片段
    const videoResult = await generateVideo(
      llmConfig,
      firstScene.videoPrompt,
      heroImageUrl,
      Math.min(storyboard.totalDuration, 10),
      aspectRatio,
      resolution,
      llmConfig.videoModel
    );

    // 3. 如果是异步模式（返回 jobId），轮询直到完成
    if (videoResult.jobId) {
      job.currentStep = "等待视频生成...";
      let attempts = 0;
      while (attempts < 60) {
        await sleep(5000);
        const status = await queryVideoJob(llmConfig, videoResult.jobId);
        if (status.status === "completed" && status.videoUrl) {
          videoResult.videoUrl = status.videoUrl;
          break;
        }
        if (status.status === "failed") {
          throw new Error(status.error ?? "视频生成失败");
        }
        attempts++;
      }
    }

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
