import { NextRequest, NextResponse } from "next/server";
import { generateImage, generateVideo, queryVideoJob } from "@/lib/api-client";
import { v4 as uuidv4 } from "uuid";
import { jobs } from "@/lib/jobs";
import type { Scene, UserLLMConfig } from "@/lib/types";

// ============================================================
// POST /api/generate/video/scene
// 为单个分镜生成视频（Railway serverless 友好：同步完成，不依赖后台任务）
// 输入: { scene, llmConfig, aspectRatio, resolution }
// 输出: { jobId, sceneId, status, videoUrl? }
// ============================================================
export async function POST(req: NextRequest) {
  let jobId = uuidv4();

  try {
    const body = await req.json() as {
      scene: Scene;
      llmConfig: UserLLMConfig;
      aspectRatio: "9:16" | "16:9" | "1:1";
      resolution: "720p" | "1080p";
      totalScenes: number;
      sceneIndex: number;
    };
    const { scene, llmConfig, aspectRatio, resolution, totalScenes, sceneIndex } = body;

    if (!scene || !llmConfig) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // 创建任务
    jobs.set(jobId, {
      id: jobId,
      storyboardId: `scene_${scene.id}`,
      status: "pending",
      progress: 0,
      currentStep: "准备生成...",
      sceneResults: [{ sceneId: scene.id }],
      createdAt: new Date().toISOString(),
      llmConfig,
    });

    // ============================================================
    // Step 1: 准备参考图
    // ============================================================
    {
      const job = jobs.get(jobId)!;
      job.status = "generating_image";
      job.progress = 10;
      job.currentStep = `分镜 ${sceneIndex + 1}/${totalScenes}：准备参考图...`;
      jobs.set(jobId, job);
    }

    let imageUrl = scene.referenceImageUrl;

    if (!imageUrl && llmConfig.imageModel) {
      const job = jobs.get(jobId)!;
      job.currentStep = `分镜 ${sceneIndex + 1}/${totalScenes}：AI 生成参考图...`;
      job.progress = 20;
      jobs.set(jobId, job);

      const imgResult = await generateImage(
        llmConfig,
        scene.imagePrompt || scene.description,
        undefined,
        aspectRatio,
        llmConfig.imageModel
      );
      imageUrl = imgResult.url;
    }

    if (!imageUrl) {
      const job = jobs.get(jobId)!;
      job.status = "failed";
      job.error = "缺少参考图，请上传图片或配置图像模型";
      jobs.set(jobId, job);
      return NextResponse.json({ jobId, sceneId: scene.id, status: "failed", error: job.error });
    }

    // ============================================================
    // Step 2: 生成视频
    // ============================================================
    {
      const job = jobs.get(jobId)!;
      job.status = "generating_video";
      job.progress = 40;
      job.currentStep = `分镜 ${sceneIndex + 1}/${totalScenes}：调用视频生成 API...`;
      jobs.set(jobId, job);
    }

    console.log(`[scene/${jobId}] 调用视频生成，模型=${llmConfig.videoModel ?? 'vidu-2.0'}，prompt=${scene.videoPrompt?.slice(0, 50)}`);

    const videoResult = await generateVideo(
      llmConfig,
      scene.videoPrompt,
      imageUrl,
      5,
      aspectRatio,
      resolution,
      llmConfig.videoModel,
      process.env.MERGE_SERVICE_URL 
        ? `${process.env.MERGE_SERVICE_URL}/api/webhooks/vidu`
        : undefined  // 本地开发不传，Railway 会自动注入
    );

    // 同步模式：直接拿到视频 URL
    if (videoResult.videoUrl) {
      const job = jobs.get(jobId)!;
      job.status = "done";
      job.progress = 100;
      job.currentStep = `分镜 ${sceneIndex + 1}/${totalScenes}：完成`;
      job.resultUrl = videoResult.videoUrl;
      job.sceneResults[0] = { sceneId: scene.id, imageUrl, videoUrl: videoResult.videoUrl };
      jobs.set(jobId, job);

      return NextResponse.json({ jobId, sceneId: scene.id, status: "done", videoUrl: videoResult.videoUrl });
    }

    // 异步模式：记录 externalJobId，前端轮询
    if (videoResult.jobId) {
      const job = jobs.get(jobId)!;
      job.externalJobId = videoResult.jobId;
      job.currentStep = `分镜 ${sceneIndex + 1}/${totalScenes}：等待视频生成...`;
      job.progress = 60;
      jobs.set(jobId, job);

      return NextResponse.json({ jobId, sceneId: scene.id, status: "pending" });
    }

    // 意外情况
    const job = jobs.get(jobId)!;
    job.status = "failed";
    job.error = "视频生成接口响应格式未知";
    jobs.set(jobId, job);
    return NextResponse.json({ jobId, sceneId: scene.id, status: "failed", error: job.error });

  } catch (err) {
    console.error(`[scene] 处理异常:`, err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "生成失败";
      jobs.set(jobId, job);
    }
    return NextResponse.json({ jobId, sceneId: undefined, status: "failed", error: err instanceof Error ? err.message : "生成失败" });
  }
}

// ============================================================
// GET /api/generate/video/scene?jobId=xxx
// 查询状态（Railway serverless：job 数据存在文件里，跨容器也能读到）
// ============================================================
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  // 如果有 externalJobId 且状态是 generating_video，查询外部任务状态
  if (job.externalJobId && job.status === "generating_video") {
    try {
      const status = await queryVideoJob(job.llmConfig!, job.externalJobId);

      if (status.status === "completed" && status.videoUrl) {
        job.status = "done";
        job.progress = 100;
        job.resultUrl = status.videoUrl;
        job.sceneResults[0] = { ...job.sceneResults[0], videoUrl: status.videoUrl };
        jobs.set(jobId, job);
      } else if (status.status === "failed") {
        job.status = "failed";
        job.error = status.error || "视频生成失败";
        jobs.set(jobId, job);
      } else {
        // 仍在处理中，模拟进度增长
        job.progress = Math.min(90, (job.progress ?? 60) + 3);
        jobs.set(jobId, job);
      }
    } catch (err) {
      console.error("Failed to query video job:", err);
    }
  }

  return NextResponse.json(job);
}
