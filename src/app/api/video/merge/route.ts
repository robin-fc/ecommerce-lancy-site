import { NextRequest, NextResponse } from "next/server";

// ============================================================
// POST /api/video/merge
//
// 前端调此接口 → Next.js 代理 → 合并服务（R2 上传）
//
// 架构说明：
//   [Next.js /api/video/merge] 
//     → [Railway: merge-service] 
//       → [Cloudflare R2]
// ============================================================

// Railway 内部服务发现，或外部 URL（本地开发用）
const MERGE_SERVICE_URL = process.env.MERGE_SERVICE_URL ?? 'http://localhost:8080';

export async function POST(req: NextRequest) {
  try {
    const { videoUrls } = (await req.json()) as { videoUrls: string[] };

    // 校验
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: "videoUrls 必填，是非空数组" },
        { status: 400 }
      );
    }

    // 单个视频无需合并
    if (videoUrls.length === 1) {
      return NextResponse.json({ mergedUrl: videoUrls[0], skipped: true });
    }

    // 检查环境配置
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
      return NextResponse.json(
        {
          error: "视频合并服务未配置（R2 环境变量缺失）",
          code: "R2_NOT_CONFIGURED",
          fallback: videoUrls[0],
        },
        { status: 503 }
      );
    }

    // 调用合并服务
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10min 超时

    try {
      const mergeRes = await fetch(`${MERGE_SERVICE_URL}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 透传 jobId（如果前端有传）
          "X-Job-ID": req.headers.get("X-Job-ID") ?? "",
        },
        body: JSON.stringify({ videoUrls }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await mergeRes.json();

      if (!mergeRes.ok) {
        console.error("[merge] 服务返回错误:", result);
        return NextResponse.json(
          { error: result.error ?? "合并失败", fallback: videoUrls[0] },
          { status: mergeRes.status }
        );
      }

      return NextResponse.json(result);
    } catch (err: unknown) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "合并服务调用失败";

      // 合并服务连不上时，返回第一个视频作为保底
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json(
          { error: "合并超时（>10分钟），已返回原视频", fallback: videoUrls[0] },
          { status: 504 }
        );
      }

      console.error("[merge] 调用失败:", message);
      return NextResponse.json(
        { error: message, fallback: videoUrls[0] },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
