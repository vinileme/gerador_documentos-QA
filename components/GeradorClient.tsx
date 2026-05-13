"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

import type { ReportPayload, ReportStructured } from "@/lib/schemas/report-payload";
import { reportSectionSchema } from "@/lib/schemas/report-payload";

const SECTION_KEYS = Object.keys(reportSectionSchema.shape) as (keyof ReportStructured)[];

const SECTION_LABELS: Record<keyof ReportStructured, string> = {
  resumo: "Resumo da funcionalidade",
  objetivoNegocio: "Objetivo de negócio",
  escopo: "Escopo",
  foraEscopo: "Fora de escopo",
  regras: "Regras de negócio identificadas",
  suposicoes: "Suposições",
  gherkin: "Critérios de aceite em Gherkin",
  testesFuncionais: "Cenários de teste funcionais",
  negativos: "Cenários negativos",
  borda: "Cenários de borda",
  uiux: "Validações de UI/UX",
  integracao: "Validações técnicas / integração",
  riscos: "Riscos de qualidade",
  perguntas: "Perguntas para refinamento",
  checklist: "Checklist final para QA",
};

type TransportMode = "idle" | "connecting" | "realtime" | "polling";

type WsIncoming =
  | { type: "progress"; jobId: string; stage: string; message?: string; percent?: number }
  | { type: "done"; jobId: string; payload: ReportPayload }
  | { type: "error"; jobId: string; code: string; message: string }
  | { type: "subscribed"; jobId: string }
  | { type: "pong" };

function wsBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:3001`;
  }
  return "ws://localhost:3001";
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function progressLabelFromStage(stage: string): string {
  const map: Record<string, string> = {
    queued: "Na fila…",
    resolve_url: "Validando URL…",
    fetch_workitem: "Obtendo work item…",
    fetch_attachments: "Buscando anexos…",
    template_rules: "Aplicando regras…",
    llm: "Gerando conteúdo…",
    finalize: "Finalizando…",
  };
  return map[stage] ?? stage.replace(/_/g, " ");
}

export function GeradorClient() {
  const [workItemUrl, setWorkItemUrl] = useState("");
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const [transportMode, setTransportMode] = useState<TransportMode>("idle");
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);
  const wsOpenedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const pageKey = SECTION_KEYS[pageIndex]!;
  const pageLabel = SECTION_LABELS[pageKey];

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-200), line]);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const applyPayload = useCallback(
    (p: ReportPayload) => {
      setPayload(p);
      setBusy(false);
      setPageIndex(0);
      stopPolling();
      setTransportMode("idle");
      setProgressPercent(null);
      setProgressLabel("");
      pushLog("Concluído: relatório pronto para preview e download.");
    },
    [pushLog, stopPolling],
  );

  const pollJob = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Falha ao consultar job (${res.status})`);
      }
      const data = (await res.json()) as
        | { status: "queued" | "running" }
        | { status: "done"; payload: ReportPayload }
        | { status: "error"; code: string; message: string };

      if (data.status === "done") applyPayload(data.payload);
      if (data.status === "error") {
        setBusy(false);
        stopPolling();
        setTransportMode("idle");
        setProgressPercent(null);
        setProgressLabel("");
        setError(data.message);
      }
    },
    [applyPayload, stopPolling],
  );

  useEffect(() => {
    if (!jobId) return;
    wsOpenedRef.current = false;
    const url = `${wsBaseUrl()}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      wsOpenedRef.current = true;
      setTransportMode("realtime");
      ws.send(JSON.stringify({ type: "subscribe", jobId }));
      pushLog(`WebSocket conectado (${url}).`);
    });

    ws.addEventListener("message", (evt) => {
      let msg: WsIncoming | null = null;
      try {
        msg = JSON.parse(String(evt.data)) as WsIncoming;
      } catch {
        return;
      }
      if (!msg) return;

      if (msg.type === "progress") {
        pushLog(`[${msg.stage}] ${msg.message ?? ""}`.trim());
        if (typeof msg.percent === "number") {
          setProgressPercent(clampPercent(msg.percent));
        }
        const label =
          (msg.message && msg.message.trim()) || progressLabelFromStage(msg.stage);
        setProgressLabel(label);
        return;
      }
      if (msg.type === "done") {
        applyPayload(msg.payload);
        ws.close();
        return;
      }
      if (msg.type === "error") {
        setError(msg.message);
        setBusy(false);
        stopPolling();
        setTransportMode("idle");
        setProgressPercent(null);
        setProgressLabel("");
        ws.close();
        return;
      }
      if (msg.type === "subscribed") {
        pushLog(`Inscrito no job: ${msg.jobId}`);
      }
    });

    ws.addEventListener("error", () => {
      setTransportMode("polling");
      pushLog("WebSocket indisponível; usando polling em /api/jobs/:id.");
    });

    ws.addEventListener("close", () => {
      wsRef.current = null;
      if (!wsOpenedRef.current && busyRef.current) {
        setTransportMode("polling");
      }
    });

    return () => {
      ws.close();
    };
  }, [jobId, applyPayload, pushLog, stopPolling]);

  useEffect(() => {
    if (!jobId || !busy) return;

    const kickoff = window.setTimeout(() => {
      void pollJob(jobId);
    }, 0);

    pollRef.current = window.setInterval(() => {
      void pollJob(jobId);
    }, 1500);

    return () => {
      window.clearTimeout(kickoff);
      stopPolling();
    };
  }, [jobId, busy, pollJob, stopPolling]);

  const start = async () => {
    setError(null);
    setPayload(null);
    setLog([]);
    setTransportMode("idle");
    setProgressPercent(null);
    setProgressLabel("");
    setBusy(true);
    setJobId(null);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemUrl, personalAccessToken: pat }),
    });

    if (!res.ok) {
      const t = await res.text();
      setBusy(false);
      setTransportMode("idle");
      setError(t || "Falha ao iniciar o job.");
      return;
    }

    const data = (await res.json()) as { jobId: string };
    setTransportMode("connecting");
    setJobId(data.jobId);
  };

  const downloadZip = async () => {
    if (!payload) return;
    const zip = new JSZip();
    zip.file("relatorio.json", JSON.stringify(payload, null, 2), { unixPermissions: 0o644 });
    zip.file("relatorio.md", payload.markdown, { unixPermissions: 0o644 });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-qa-${payload.meta.workItemId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageBody = useMemo(() => {
    if (!payload) return "";
    return payload.structured[pageKey] ?? "";
  }, [payload, pageKey]);

  const transportStatusLine = useMemo(() => {
    if (busy) {
      if (transportMode === "connecting") return "Conectando ao tempo real…";
      if (transportMode === "realtime") return "Atualizações em tempo real.";
      if (transportMode === "polling") return "Modo alternativo: verificação periódica.";
    }
    if (transportMode === "idle" && !busy) return "Pronto para gerar.";
    return "—";
  }, [busy, transportMode]);

  const showDeterminateBar =
    busy && transportMode === "realtime" && typeof progressPercent === "number";
  const showIndeterminateBar =
    busy &&
    (transportMode === "polling" ||
      (transportMode === "realtime" && progressPercent === null) ||
      transportMode === "connecting");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Gerador de documentação QA (Azure DevOps)
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Informe o link da User Story ou Epic e um PAT com leitura de work items. O relatório{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">não é armazenado</span> no
          servidor: use o preview e baixe o ZIP localmente.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">URL do work item</span>
            <input
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              value={workItemUrl}
              onChange={(e) => setWorkItemUrl(e.target.value)}
              placeholder="https://dev.azure.com/org/proj/_workitems/edit/123"
              autoComplete="off"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Personal Access Token (PAT)
            </span>
            <input
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Não é armazenado após o processamento"
              type="password"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || !workItemUrl.trim() || !pat.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Processando…" : "Gerar documentação"}
          </button>

          <button
            type="button"
            onClick={() => void downloadZip()}
            disabled={!payload}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50"
          >
            Baixar ZIP (.md + .json)
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Progresso</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{transportStatusLine}</p>

        {busy ? (
          <>
            {progressLabel ? (
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{progressLabel}</p>
            ) : transportMode === "polling" ? (
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                Processando em segundo plano (sem etapas detalhadas neste modo).
              </p>
            ) : null}

            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={showDeterminateBar ? progressPercent! : undefined}
              aria-busy={true}
              aria-label="Progresso da geração"
            >
              {showDeterminateBar ? (
                <div
                  className="h-full rounded-full bg-zinc-700 transition-[width] duration-300 ease-out dark:bg-zinc-300"
                  style={{ width: `${progressPercent}%` }}
                />
              ) : showIndeterminateBar ? (
                <div className="h-full w-2/5 rounded-full bg-zinc-600 gerador-progress-indeterminate dark:bg-zinc-400" />
              ) : null}
            </div>
          </>
        ) : null}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
            Detalhes técnicos (log)
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {log.length ? log.join("\n") : busy ? "Aguardando eventos…" : "—"}
          </pre>
        </details>
      </section>

      {payload ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preview</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                WI #{payload.meta.workItemId} · {payload.meta.workItemType} · {payload.meta.title}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs sm:max-w-md">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Seção</span>
                <select
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  value={pageIndex}
                  onChange={(e) => setPageIndex(Number(e.target.value))}
                >
                  {SECTION_KEYS.map((key, i) => (
                    <option key={key} value={i}>
                      {SECTION_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-700"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                >
                  Anterior
                </button>
                <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                  {pageIndex + 1}/{SECTION_KEYS.length}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-700"
                  disabled={pageIndex >= SECTION_KEYS.length - 1}
                  onClick={() => setPageIndex((i) => Math.min(SECTION_KEYS.length - 1, i + 1))}
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>

          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">{pageLabel}</h3>
          <pre className="mt-2 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
            {pageBody}
          </pre>

          {payload.meta.warnings.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              <p className="font-medium">Avisos</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {payload.meta.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
