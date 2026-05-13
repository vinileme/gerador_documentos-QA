import { NextResponse } from "next/server";
import { z } from "zod";

import { createJobId, scheduleAnalysisJob } from "@/lib/jobs";

export const runtime = "nodejs";

const postSchema = z.object({
  workItemUrl: z.string().min(1),
  personalAccessToken: z.string().min(1),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe workItemUrl e personalAccessToken.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const jobId = createJobId();
  scheduleAnalysisJob(jobId, parsed.data.workItemUrl.trim(), parsed.data.personalAccessToken.trim());

  return NextResponse.json({
    jobId,
    pollUrl: `/api/jobs/${jobId}`,
  });
}
