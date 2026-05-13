import "server-only";

import type { WorkItemRelation } from "./types";

export type AttachmentRef = {
  name: string;
  url: string;
  resourceSize?: number;
};

export function listAttachedFiles(relations: WorkItemRelation[] | undefined): AttachmentRef[] {
  if (!relations?.length) return [];
  const out: AttachmentRef[] = [];
  for (const rel of relations) {
    if (rel.rel !== "AttachedFile") continue;
    const attrs = rel.attributes ?? {};
    const name =
      (typeof attrs.name === "string" && attrs.name) ||
      (typeof attrs.comment === "string" && attrs.comment) ||
      "anexo";
    const resourceSize =
      typeof attrs.resourceSize === "number" ? attrs.resourceSize : undefined;
    out.push({ name, url: rel.url, resourceSize });
  }
  return out;
}
