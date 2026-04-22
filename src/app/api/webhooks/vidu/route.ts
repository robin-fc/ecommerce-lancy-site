import { NextRequest, NextResponse } from "next/server";
import { jobs } from "@/lib/jobs";

// ============================================================
// POST /api/webhooks/vidu
// Vidu 任务完成回调（比轮询更高效）
// Vidu 会 POST JSON: { task_id, state, creations: [{ url, cover_url }] }
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      task_id?: string;
      state?: string;
      creations?: { id: string; url: string; cover_url: string }[];
      error_msg?: string;
    };

    const { task_id, state, creations, error_msg } = body;

    // 查找对应的本地任务
    for (const [jobId, job] of jobs) {
      if (job.externalJobId === task_id) {
        if (state === "success" && creations?.[0]?.url) {
          job.status = "done";
          job.progress = 100;
          job.resultUrl = creations[0].url;
          job.sceneResults[0] = {
            sceneId: job.sceneResults[0]?.sceneId,
            imageUrl: job.sceneResults[0]?.imageUrl,
            videoUrl: creations[0].url,
          };
          jobs.set(jobId, job);
          return NextResponse.json({ ok: true, jobId });
        }
        if (state === "failed") {
          job.status = "failed";
          job.error = error_msg || "视频生成失败";
          jobs.set(jobId, job);
          return NextResponse.json({ ok: true, jobId });
        }
      }
    }

    return NextResponse.json({ error: "任务未找到" }, { status: 404 });
  } catch (err) {
    console.error("[webhook] 处理异常:", err);
    return NextResponse.json({ error: "处理失败" }, { status: 500 });
  }
}