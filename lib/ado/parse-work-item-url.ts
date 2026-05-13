import type { ParsedWorkItemRef } from "./types";

const DEV_AZURE = "dev.azure.com";

/**
 * Parses Azure DevOps work item URLs into org/project/id.
 * Supports dev.azure.com and *.visualstudio.com edit links.
 */
export function parseWorkItemUrl(raw: string): ParsedWorkItemRef {
  const input = raw.trim();
  if (!input) {
    throw new Error("URL do work item está vazia.");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL inválida. Use o link completo do work item no Azure DevOps.");
  }

  const host = url.hostname.toLowerCase();

  if (host === DEV_AZURE) {
    const parts = url.pathname.split("/").filter(Boolean);
    // dev.azure.com/{org}/{project}/_workitems/edit/{id}
    const org = parts[0];
    const project = parts[1];
    const editIdx = parts.indexOf("edit");
    const idStr = editIdx >= 0 ? parts[editIdx + 1] : undefined;
    if (!org || !project || !idStr) {
      throw new Error(
        "Formato esperado: https://dev.azure.com/{org}/{project}/_workitems/edit/{id}",
      );
    }
    const workItemId = Number(idStr);
    if (!Number.isFinite(workItemId)) {
      throw new Error("ID do work item não é numérico.");
    }
    return { host: "dev.azure.com", organization: org, project, workItemId };
  }

  if (host.endsWith(".visualstudio.com")) {
    const org = host.replace(/\.visualstudio\.com$/i, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const project = parts[0];
    const editIdx = parts.indexOf("edit");
    const idStr = editIdx >= 0 ? parts[editIdx + 1] : undefined;
    if (!project || !idStr) {
      throw new Error(
        "Formato esperado: https://{org}.visualstudio.com/{project}/_workitems/edit/{id}",
      );
    }
    const workItemId = Number(idStr);
    if (!Number.isFinite(workItemId)) {
      throw new Error("ID do work item não é numérico.");
    }
    return { host: "visualstudio.com", organization: org, project, workItemId };
  }

  throw new Error("Host não suportado. Use dev.azure.com ou *.visualstudio.com.");
}

export function workItemRestBase(ref: ParsedWorkItemRef): string {
  if (ref.host === "dev.azure.com") {
    return `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(ref.project)}`;
  }
  return `https://${encodeURIComponent(ref.organization)}.visualstudio.com/${encodeURIComponent(ref.project)}`;
}
