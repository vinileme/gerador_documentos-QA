import type { ReportStructured } from "@/lib/schemas/report-payload";

const ORDER: (keyof ReportStructured)[] = [
  "resumo",
  "objetivoNegocio",
  "escopo",
  "foraEscopo",
  "regras",
  "suposicoes",
  "gherkin",
  "testesFuncionais",
  "negativos",
  "borda",
  "uiux",
  "integracao",
  "riscos",
  "perguntas",
  "checklist",
];

const TITLES: Record<keyof ReportStructured, string> = {
  resumo: "Resumo da funcionalidade",
  objetivoNegocio: "Objetivo de negócio",
  escopo: "Escopo",
  foraEscopo: "Fora de escopo",
  regras: "Regras de negócio identificadas",
  suposicoes: "Suposições",
  gherkin: "Critérios de aceite em Gherkin (rascunho)",
  testesFuncionais: "Cenários de teste funcionais",
  negativos: "Cenários negativos",
  borda: "Cenários de borda",
  uiux: "Validações de UI/UX",
  integracao: "Validações técnicas / integração",
  riscos: "Riscos de qualidade",
  perguntas: "Perguntas para refinamento",
  checklist: "Checklist final para QA",
};

export function structuredToMarkdown(structured: ReportStructured): string {
  const parts: string[] = ["# Documentação QA (gerada a partir do Azure DevOps)", ""];
  for (const key of ORDER) {
    parts.push(`## ${TITLES[key]}`, "", structured[key].trim(), "", "---", "");
  }
  return parts.join("\n").trim() + "\n";
}
