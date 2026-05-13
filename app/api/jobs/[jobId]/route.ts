import { NextResponse } from "next/server";

import { jobResultStore } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const record = jobResultStore.get(jobId);
  if (!record) {
    return NextResponse.json({ error: "Job não encontrado ou expirado." }, { status: 404 });
  }

  if (record.status === "done") {
    return NextResponse.json({ status: "done", payload: record.payload });
  }
  if (record.status === "error") {
    return NextResponse.json({
      status: "error",
      code: record.code,
      message: record.message,
    });
  }

  return NextResponse.json({ status: record.status });
}
