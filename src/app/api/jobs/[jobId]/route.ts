import { NextRequest, NextResponse } from "next/server";
import { jobs } from "@/lib/jobs";

// GET /api/jobs/[jobId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json(job);
}
