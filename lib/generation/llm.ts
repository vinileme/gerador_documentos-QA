import "server-only";

import { MAX_LLM_OUTPUT_CHARS } from "@/lib/config";
import type { ReportStructured } from "@/lib/schemas/report-payload";
import { reportSectionSchema } from "@/lib/schemas/report-payload";
import type { NormalizedWorkItem } from "./types";

const SECTION_KEYS = Object.keys(reportSectionSchema.shape) as (keyof ReportStructured)[];

function buildContext(n: NormalizedWorkItem): string {
  const att = n.attachments
    .filter((a) => a.text.trim())
    .map((a) => `FILE:${a.name}\n${a.text.slice(0, 50_000)}`)
    .join("\n\n---\n\n");
  return JSON.stringify(
    {
      workItemId: n.workItemId,
      workItemType: n.workItemType,
      title: n.title,
      descriptionPlain: n.descriptionPlain.slice(0, 80_000),
      acceptanceCriteriaPlain: n.acceptanceCriteriaPlain.slice(0, 40_000),
      attachmentsExtracted: att.slice(0, 200_000),
    },
    null,
    2,
  );
}

function mergeDraftWithLlm(draft: ReportStructured, partial: Partial<ReportStructured>): ReportStructured {
  const out = { ...draft };
  for (const key of SECTION_KEYS) {
    const v = partial[key];
    if (typeof v === "string" && v.trim().length > 0) {
      out[key] = v.trim();
    }
  }
  return out;
}

export async function augmentWithLlm(
  normalized: NormalizedWorkItem,
  draft: ReportStructured,
): Promise<{ structured: ReportStructured; llmWarning?: string }> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return {
      structured: draft,
      llmWarning:
        "LLM não configurada (defina LLM_API_KEY). O relatório contém apenas o template determinístico.",
    };
  }

  const system = [
    "Você é um QA Lead especialista em análise de requisitos.",
    "Responda em PT-BR.",
    "Retorne SOMENTE JSON (objeto) com chaves idênticas ao objeto draftSections.",
    "Para cada chave, produza texto markdown simples (parágrafos e listas com hífen).",
    "Não invente fatos: se algo não estiver sustentado pelo contexto, marque explicitamente como (suposição).",
    "Se não houver informação suficiente, escreva lacunas e perguntas objetivas na seção perguntas.",
    "Não inclua comentários fora do JSON.",
  ].join(" ");

  const userPayload = {
    draftSections: draft,
    contextoAdo: buildContext(normalized),
    instrucao:
      "Melhore o draftSections usando apenas o contextoAdo. Preencha seções fracas. Mantenha consistência.",
  };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload).slice(0, 200_000) },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    return {
      structured: draft,
      llmWarning: `LLM indisponível (${res.status}): ${t.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.length > MAX_LLM_OUTPUT_CHARS) {
    return {
      structured: draft,
      llmWarning: "Resposta do LLM vazia ou excessiva; mantido o template determinístico.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return { structured: draft, llmWarning: "JSON do LLM inválido; mantido o template determinístico." };
  }

  const obj = (parsed as { draftSections?: unknown }).draftSections ?? parsed;
  const partial = obj as Partial<ReportStructured>;
  const merged = mergeDraftWithLlm(draft, partial);
  return { structured: merged };
}
