import "server-only";

import { ADO_API_VERSION, ACCEPTANCE_CRITERIA_FIELD } from "@/lib/config";
import { basicAuthHeader } from "./auth";
import type { AdoWorkItemResponse, ParsedWorkItemRef } from "./types";
import { workItemRestBase } from "./parse-work-item-url";

export async function fetchWorkItemJson(
  ref: ParsedWorkItemRef,
  pat: string,
): Promise<AdoWorkItemResponse> {
  const base = workItemRestBase(ref);
  const url = `${base}/_apis/wit/workitems/${ref.workItemId}?$expand=relations&api-version=${ADO_API_VERSION}`;
  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(pat),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Sem permissão para ler o work item. Verifique o PAT e o escopo (Work Items: Read).",
    );
  }
  if (res.status === 404) {
    throw new Error("Work item não encontrado ou projeto incorreto.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao consultar o Azure DevOps (${res.status}): ${body.slice(0, 500)}`);
  }

  return (await res.json()) as AdoWorkItemResponse;
}

export function getFieldString(fields: Record<string, unknown>, key: string): string {
  const v = fields[key];
  if (typeof v === "string") return v;
  return "";
}

export function getTitle(fields: Record<string, unknown>): string {
  return getFieldString(fields, "System.Title");
}

export function getWorkItemType(fields: Record<string, unknown>): string {
  return getFieldString(fields, "System.WorkItemType");
}

export function getDescriptionHtml(fields: Record<string, unknown>): string {
  return getFieldString(fields, "System.Description");
}

export function getAcceptanceCriteriaHtml(
  fields: Record<string, unknown>,
  fieldRef: string = ACCEPTANCE_CRITERIA_FIELD,
): string {
  return getFieldString(fields, fieldRef);
}

export function getHtmlUrlFromWorkItem(item: AdoWorkItemResponse): string | undefined {
  const href = (item as unknown as { _links?: { html?: { href?: string } } })._links?.html?.href;
  return typeof href === "string" ? href : undefined;
}
