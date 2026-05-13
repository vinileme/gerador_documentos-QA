import { emptyStructured, type ReportStructured } from "@/lib/schemas/report-payload";
import type { NormalizedWorkItem } from "./types";

function joinAttachments(n: NormalizedWorkItem): string {
  return n.attachments
    .filter((a) => a.text.trim().length > 0)
    .map((a) => `### ${a.name}\n${a.text}`)
    .join("\n\n");
}

/**
 * Deterministic baseline from ADO fields (before LLM enrichment).
 */
export function applyTemplateAndRules(n: NormalizedWorkItem): ReportStructured {
  const s = emptyStructured();
  const att = joinAttachments(n);

  s.resumo = [
    `Work item: ${n.workItemType} #${n.workItemId}`,
    `Título: ${n.title}`,
    n.descriptionPlain ? `Descrição (texto):\n${n.descriptionPlain}` : "Descrição: (vazia no ADO)",
    n.acceptanceCriteriaPlain
      ? `Critérios de aceite (texto):\n${n.acceptanceCriteriaPlain}`
      : "Critérios de aceite: (vazios no ADO ou campo não preenchido)",
    att ? `Texto extraído de anexos:\n${att}` : "Anexos: nenhum texto extraído.",
  ]
    .filter(Boolean)
    .join("\n\n");

  s.objetivoNegocio =
    "Não identificado explicitamente no work item. **(suposição)** Preencha com o objetivo de negócio ao revisar com o PO.";

  s.escopo =
    "Derivado do que está descrito na User Story/Epic e nos anexos processados. Ajuste com o time se houver divergência.";

  s.foraEscopo =
    "Não declarado no work item. Liste explicitamente o que não será entregue neste item.";

  s.regras =
    "Extraia regras objetivas a partir da descrição e dos critérios de aceite. O que estiver implícito deve ser marcado como suposição na seção dedicada.";

  s.suposicoes = [
    "Itens inferidos a partir de linguagem ambígua devem ser validados com o PO.",
    "Campos vazios no ADO geram lacunas de teste até o refinamento.",
  ].join("\n");

  s.gherkin = n.acceptanceCriteriaPlain
    ? [
        "Sugestão: converta cada critério de aceite confirmado em cenários Gherkin.",
        "",
        "Feature: (nome da feature)",
        "",
        "Scenario: (feliz)",
        "  Given ...",
        "  When ...",
        "  Then ...",
      ].join("\n")
    : "Sem critérios de aceite textuais no ADO; gere Gherkin após o PO preencher o campo.";

  s.testesFuncionais =
    "Listar fluxos principais cobertos pela descrição e pelos AC. Associar cada fluxo a dados de entrada esperados.";

  s.negativos =
    "Permissões inválidas, validações de formulário, indisponibilidade de integrações, timeouts e erros de API.";

  s.borda =
    "Limites numéricos, campos vazios, caracteres especiais, volumes altos, concorrência (se aplicável).";

  s.uiux =
    "Estados de carregamento/erro, mensagens ao usuário, acessibilidade básica (rótulos, foco), consistência visual.";

  s.integracao =
    "Somente o que puder ser inferido a partir da descrição/anexos. Detalhar endpoints, autenticação e contratos com o time de desenvolvimento.";

  s.riscos =
    "Dependência de informações incompletas; possível retrabalho se AC não estiver alinhado à implementação.";

  s.perguntas = buildQuestions(n);

  s.checklist = [
    "[ ] Tipos de work item e campos conferidos no ADO",
    "[ ] Critérios de aceite revisados com o PO",
    "[ ] Dados de teste e pré-condições definidos",
    "[ ] Casos negativos e de borda priorizados",
    "[ ] Evidências de teste alinhadas ao processo do time",
  ].join("\n");

  return s;
}

function buildQuestions(n: NormalizedWorkItem): string {
  const lines: string[] = [];
  if (!n.descriptionPlain.trim()) {
    lines.push("- A descrição está vazia: qual é o comportamento esperado end-to-end?");
  }
  if (!n.acceptanceCriteriaPlain.trim()) {
    lines.push("- Os critérios de aceite estão vazios: quais condições definem pronto?");
  }
  if (!n.attachments.some((a) => a.text.trim())) {
    lines.push("- Não há texto extraído de anexos: há documentação oficial em outro lugar?");
  }
  lines.push("- Há integrações externas obrigatórias para este item? Quais ambientes?");
  lines.push("- Existem regras de negócio explícitas não escritas (cálculos, SLAs, permissões)?");
  return lines.join("\n");
}
