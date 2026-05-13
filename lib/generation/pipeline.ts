import "server-only";

import { ALLOWED_WORK_ITEM_TYPES } from "@/lib/config";
import {
  fetchWorkItemJson,
  getTitle,
  getWorkItemType,
  parseWorkItemUrl,
} from "@/lib/ado";
import type { ReportPayload } from "@/lib/schemas/report-payload";
import { reportPayloadSchema } from "@/lib/schemas/report-payload";
import { normalizeWorkItemForGeneration, type GenerationProgress } from "./normalize";
import { applyTemplateAndRules } from "./rules";
import { structuredToMarkdown } from "./markdown";
import { augmentWithLlm } from "./llm";

export function assertAllowedWorkItemType(workItemType: string): void {
  if (!ALLOWED_WORK_ITEM_TYPES.includes(workItemType)) {
    throw new Error(
      `Tipo de work item não permitido: "${workItemType}". ` +
        `Tipos aceitos (ajustáveis via ALLOWED_WORK_ITEM_TYPES): ${ALLOWED_WORK_ITEM_TYPES.join(", ")}`,
    );
  }
}

export async function buildReportPayload(
  workItemUrl: string,
  pat: string,
  onProgress?: GenerationProgress,
): Promise<{ payload: ReportPayload; warnings: string[] }> {
  const ref = parseWorkItemUrl(workItemUrl);
  await onProgress?.({ stage: "resolve_url", message: "URL validada.", percent: 10 });

  const item = await fetchWorkItemJson(ref, pat);
  await onProgress?.({ stage: "fetch_workitem", message: "Work item obtido no ADO.", percent: 25 });

  const wiType = getWorkItemType(item.fields);
  assertAllowedWorkItemType(wiType);

  const { normalized, warnings: normWarnings } = await normalizeWorkItemForGeneration(
    ref,
    pat,
    item,
    onProgress,
  );

  const draft = applyTemplateAndRules(normalized);
  await onProgress?.({
    stage: "template_rules",
    message: "Template determinístico aplicado.",
    percent: 70,
  });

  await onProgress?.({
    stage: "llm",
    message: "Enriquecimento com LLM (se configurado)…",
    percent: 80,
  });
  const { structured, llmWarning } = await augmentWithLlm(normalized, draft);
  const markdown = structuredToMarkdown(structured);

  await onProgress?.({ stage: "finalize", message: "Montando payload final.", percent: 95 });

  const warnings = [...normWarnings];
  if (llmWarning) warnings.push(llmWarning);

  const fromAdo: Record<string, string> = {
    titulo: getTitle(item.fields),
    descricaoPlain: normalized.descriptionPlain,
    criteriosAceitePlain: normalized.acceptanceCriteriaPlain,
  };

  const payload: ReportPayload = {
    version: 1,
    structured,
    markdown,
    meta: {
      workItemId: item.id,
      workItemType: wiType,
      title: getTitle(item.fields),
      adoWebUrl: normalized.adoWebUrl,
      generatedAt: new Date().toISOString(),
      warnings,
    },
    provenance: {
      fromAdo,
      inferredNotes: [
        "Seções enriquecidas por LLM podem conter (suposição) quando não houver evidência explícita no ADO.",
      ],
    },
  };

  return { payload: reportPayloadSchema.parse(payload), warnings };
}
