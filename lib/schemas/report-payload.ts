import { z } from "zod";

export const reportSectionSchema = z.object({
  resumo: z.string(),
  objetivoNegocio: z.string(),
  escopo: z.string(),
  foraEscopo: z.string(),
  regras: z.string(),
  suposicoes: z.string(),
  gherkin: z.string(),
  testesFuncionais: z.string(),
  negativos: z.string(),
  borda: z.string(),
  uiux: z.string(),
  integracao: z.string(),
  riscos: z.string(),
  perguntas: z.string(),
  checklist: z.string(),
});

export type ReportStructured = z.infer<typeof reportSectionSchema>;

export const reportMetaSchema = z.object({
  workItemId: z.number(),
  workItemType: z.string(),
  title: z.string(),
  adoWebUrl: z.string().optional(),
  generatedAt: z.string(),
  warnings: z.array(z.string()),
});

export type ReportMeta = z.infer<typeof reportMetaSchema>;

export const reportProvenanceSchema = z.object({
  fromAdo: z.record(z.string(), z.string()),
  inferredNotes: z.array(z.string()).optional(),
});

export type ReportProvenance = z.infer<typeof reportProvenanceSchema>;

export const reportPayloadSchema = z.object({
  version: z.literal(1),
  structured: reportSectionSchema,
  markdown: z.string(),
  meta: reportMetaSchema,
  provenance: reportProvenanceSchema,
});

export type ReportPayload = z.infer<typeof reportPayloadSchema>;

export function emptyStructured(): ReportStructured {
  return {
    resumo: "",
    objetivoNegocio: "",
    escopo: "",
    foraEscopo: "",
    regras: "",
    suposicoes: "",
    gherkin: "",
    testesFuncionais: "",
    negativos: "",
    borda: "",
    uiux: "",
    integracao: "",
    riscos: "",
    perguntas: "",
    checklist: "",
  };
}
