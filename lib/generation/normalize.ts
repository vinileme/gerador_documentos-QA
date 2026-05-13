import "server-only";

import type { ParsedWorkItemRef } from "@/lib/ado/types";
import {
  getAcceptanceCriteriaHtml,
  getDescriptionHtml,
  getHtmlUrlFromWorkItem,
  getTitle,
  getWorkItemType,
  htmlFieldToPlainText,
} from "@/lib/ado";
import type { AdoWorkItemResponse } from "@/lib/ado/types";
import { downloadAttachment } from "@/lib/ado/download-attachment";
import { listAttachedFiles } from "@/lib/ado/attachments-meta";
import { extractAttachment, classifyAttachment } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES, MAX_TOTAL_ATTACHMENT_BYTES } from "@/lib/config";
import type { NormalizedAttachment, NormalizedWorkItem } from "./types";

export type GenerationProgress = (input: {
  stage: string;
  message?: string;
  percent?: number;
}) => void | Promise<void>;

export async function normalizeWorkItemForGeneration(
  ref: ParsedWorkItemRef,
  pat: string,
  item: AdoWorkItemResponse,
  onProgress?: GenerationProgress,
): Promise<{ normalized: NormalizedWorkItem; warnings: string[] }> {
  const fields = item.fields;
  const title = getTitle(fields);
  const workItemType = getWorkItemType(fields);
  const descriptionPlain = htmlFieldToPlainText(getDescriptionHtml(fields));
  const acceptanceCriteriaPlain = htmlFieldToPlainText(getAcceptanceCriteriaHtml(fields));
  const adoWebUrl = getHtmlUrlFromWorkItem(item);

  const warnings: string[] = [];
  const attachments: NormalizedAttachment[] = [];
  const metas = listAttachedFiles(item.relations);
  let totalBytes = 0;

  for (const meta of metas) {
    await onProgress?.({
      stage: "fetch_attachments",
      message: `Processando anexo: ${meta.name}`,
      percent: 35,
    });
    const size = meta.resourceSize ?? 0;
    if (size > MAX_ATTACHMENT_BYTES) {
      warnings.push(`Anexo ignorado por tamanho (${meta.name}): ${size} bytes.`);
      attachments.push({
        name: meta.name,
        text: "",
        skippedReason: `Excede limite de ${MAX_ATTACHMENT_BYTES} bytes por anexo.`,
      });
      continue;
    }

    if (classifyAttachment(meta.name) === "other") {
      warnings.push(`Anexo não suportado (não processado): ${meta.name}`);
      attachments.push({
        name: meta.name,
        text: "",
        skippedReason: "Formato não suportado (apenas PDF, DOCX, XLSX).",
      });
      continue;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await downloadAttachment(pat, meta.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Falha ao baixar anexo ${meta.name}: ${msg}`);
      attachments.push({ name: meta.name, text: "", error: msg });
      continue;
    }

    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      warnings.push(`Anexo ignorado após download (${meta.name}): tamanho ${buffer.byteLength}.`);
      attachments.push({
        name: meta.name,
        text: "",
        skippedReason: `Excede limite de ${MAX_ATTACHMENT_BYTES} bytes por anexo.`,
      });
      continue;
    }

    if (totalBytes + buffer.byteLength > MAX_TOTAL_ATTACHMENT_BYTES) {
      warnings.push(`Limite total de anexos atingido; ignorado: ${meta.name}`);
      attachments.push({
        name: meta.name,
        text: "",
        skippedReason: `Excede limite total de ${MAX_TOTAL_ATTACHMENT_BYTES} bytes.`,
      });
      continue;
    }

    totalBytes += buffer.byteLength;
    await onProgress?.({
      stage: `extract_${classifyAttachment(meta.name)}`,
      message: meta.name,
      percent: 45,
    });
    const outcome = await extractAttachment(meta.name, buffer);
    if (outcome.kind === "skipped") {
      warnings.push(`${meta.name}: ${outcome.reason}`);
      attachments.push({ name: meta.name, text: "", skippedReason: outcome.reason });
    } else if (outcome.kind === "error") {
      warnings.push(`${meta.name}: ${outcome.message}`);
      attachments.push({ name: meta.name, text: "", error: outcome.message });
    } else {
      attachments.push({ name: meta.name, text: outcome.text });
    }
  }

  const normalized: NormalizedWorkItem = {
    ref,
    workItemId: item.id,
    workItemType,
    title,
    descriptionPlain,
    acceptanceCriteriaPlain,
    adoWebUrl,
    attachments,
  };

  return { normalized, warnings };
}
