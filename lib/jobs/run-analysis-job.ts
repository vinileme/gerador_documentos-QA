import "server-only";

import { randomUUID } from "node:crypto";

import { buildReportPayload } from "@/lib/generation/pipeline";
import type { GenerationProgress } from "@/lib/generation/normalize";
import { emitWsEvent } from "@/lib/internal/ws-emit";
import { jobPatStore, jobResultStore } from "./store";

export function createJobId(): string {
  return randomUUID();
}

async function emitProgress(
  jobId: string,
  input: { stage: string; message?: string; percent?: number },
): Promise<void> {
  await emitWsEvent({
    type: "progress",
    jobId,
    stage: input.stage,
    message: input.message,
    percent: input.percent,
  });
}

export function scheduleAnalysisJob(jobId: string, workItemUrl: string, pat: string): void {
  jobPatStore.set(jobId, pat);
  jobResultStore.set(jobId, { status: "queued" });

  const onProgress: GenerationProgress = async (p) => {
    await emitProgress(jobId, p);
  };

  void (async () => {
    jobResultStore.set(jobId, { status: "running" });
    await emitProgress(jobId, { stage: "queued", message: "Iniciando processamento…", percent: 1 });
    try {
      const { payload } = await buildReportPayload(workItemUrl, pat, onProgress);
      jobResultStore.set(jobId, { status: "done", payload });
      await emitWsEvent({ type: "done", jobId, payload });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      jobResultStore.set(jobId, { status: "error", code: "JOB_FAILED", message });
      await emitWsEvent({ type: "error", jobId, code: "JOB_FAILED", message });
    } finally {
      jobPatStore.delete(jobId);
    }
  })();
}
