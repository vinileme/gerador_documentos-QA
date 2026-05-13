export type WsEmitEvent =
  | {
      type: "progress";
      jobId: string;
      stage: string;
      message?: string;
      percent?: number;
    }
  | { type: "done"; jobId: string; payload: unknown }
  | { type: "error"; jobId: string; code: string; message: string };

export async function emitWsEvent(event: WsEmitEvent): Promise<void> {
  const base = process.env.WS_INTERNAL_BASE_URL?.trim();
  const secret = process.env.JOB_INTERNAL_SECRET?.trim();
  if (!base || !secret) {
    return;
  }

  const url = `${base.replace(/\/$/, "")}/internal/emit`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // WS bridge is best-effort; clients can still poll GET /api/jobs/:id
  }
}
