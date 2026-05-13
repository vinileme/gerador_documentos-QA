/**
 * Central limits and defaults (tune via env where noted).
 */
export const MAX_ATTACHMENT_BYTES = Number(
  process.env.MAX_ATTACHMENT_BYTES ?? 15 * 1024 * 1024,
);

export const MAX_TOTAL_ATTACHMENT_BYTES = Number(
  process.env.MAX_TOTAL_ATTACHMENT_BYTES ?? 40 * 1024 * 1024,
);

export const MAX_LLM_OUTPUT_CHARS = Number(
  process.env.MAX_LLM_OUTPUT_CHARS ?? 48_000,
);

export const JOB_PAT_TTL_MS = Number(process.env.JOB_PAT_TTL_MS ?? 30 * 60 * 1000);

export const JOB_RESULT_TTL_MS = Number(
  process.env.JOB_RESULT_TTL_MS ?? 30 * 60 * 1000,
);

/** Work item types accepted (add Portuguese variants common in ADO). */
export const ALLOWED_WORK_ITEM_TYPES = (
  process.env.ALLOWED_WORK_ITEM_TYPES?.split(",").map((s) => s.trim()) ?? [
    "User Story",
    "Epic",
    "História de Usuário",
    "Épica",
  ]
).filter(Boolean);

export const ADO_API_VERSION = process.env.ADO_API_VERSION ?? "7.1";

export const ACCEPTANCE_CRITERIA_FIELD =
  process.env.ACCEPTANCE_CRITERIA_FIELD ?? "Microsoft.VSTS.Common.AcceptanceCriteria";
