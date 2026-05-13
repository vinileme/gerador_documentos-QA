import type { ReportPayload } from "@/lib/schemas/report-payload";
import { JOB_PAT_TTL_MS, JOB_RESULT_TTL_MS } from "@/lib/config";

export type JobStatus = "queued" | "running" | "done" | "error";

export type JobResultRecord =
  | { status: "queued" | "running" }
  | { status: "done"; payload: ReportPayload }
  | { status: "error"; code: string; message: string };

const patByJob = new Map<string, { pat: string; createdAt: number }>();
const resultByJob = new Map<string, JobResultRecord & { updatedAt: number }>();

function pruneMaps() {
  const now = Date.now();
  for (const [id, v] of patByJob) {
    if (now - v.createdAt > JOB_PAT_TTL_MS) patByJob.delete(id);
  }
  for (const [id, v] of resultByJob) {
    if (now - v.updatedAt > JOB_RESULT_TTL_MS) resultByJob.delete(id);
  }
}

export const jobPatStore = {
  set(jobId: string, pat: string) {
    pruneMaps();
    patByJob.set(jobId, { pat, createdAt: Date.now() });
  },
  get(jobId: string): string | undefined {
    const v = patByJob.get(jobId);
    if (!v) return undefined;
    if (Date.now() - v.createdAt > JOB_PAT_TTL_MS) {
      patByJob.delete(jobId);
      return undefined;
    }
    return v.pat;
  },
  delete(jobId: string) {
    patByJob.delete(jobId);
  },
};

export const jobResultStore = {
  set(jobId: string, record: JobResultRecord) {
    pruneMaps();
    resultByJob.set(jobId, { ...record, updatedAt: Date.now() } as JobResultRecord & { updatedAt: number });
  },
  get(jobId: string): JobResultRecord | undefined {
    const v = resultByJob.get(jobId);
    if (!v) return undefined;
    if (Date.now() - v.updatedAt > JOB_RESULT_TTL_MS) {
      resultByJob.delete(jobId);
      return undefined;
    }
    const { updatedAt, ...rest } = v;
    void updatedAt;
    return rest as JobResultRecord;
  },
};

setInterval(pruneMaps, 60_000).unref?.();
