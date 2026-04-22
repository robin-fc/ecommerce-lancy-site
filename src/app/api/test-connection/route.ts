import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/api-client";
import type { UserLLMConfig } from "@/lib/types";

// POST /api/test-connection
// 测试用户提供的 LLM 配置是否有效
export async function POST(req: NextRequest) {
  try {
    const config = (await req.json()) as UserLLMConfig;

    if (!config.apiKey || !config.providerId) {
      return NextResponse.json({ ok: false, msg: "缺少必填字段" }, { status: 400 });
    }

    // 用一个简单的 chat 请求测试连通性
    const start = Date.now();
    await chatCompletion(
      config,
      [{ role: "user", content: "Hi, reply with OK" }],
      config.chatModel
    );
    const latency = Date.now() - start;

    return NextResponse.json({
      ok: true,
      msg: `连接成功，响应 ${latency}ms`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "连接失败";
    return NextResponse.json({ ok: false, msg: message });
  }
}
