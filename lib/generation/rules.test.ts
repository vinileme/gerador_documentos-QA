import { describe, expect, it } from "vitest";

import type { ParsedWorkItemRef } from "@/lib/ado/types";
import type { NormalizedWorkItem } from "./types";
import { applyTemplateAndRules } from "./rules";

function sampleNormalized(): NormalizedWorkItem {
  const ref: ParsedWorkItemRef = {
    host: "dev.azure.com",
    organization: "o",
    project: "p",
    workItemId: 1,
  };
  return {
    ref,
    workItemId: 1,
    workItemType: "User Story",
    title: "Login",
    descriptionPlain: "Como usuário quero autenticar.",
    acceptanceCriteriaPlain: "Dado usuário válido então sessão criada.",
    adoWebUrl: "https://dev.azure.com/o/p/_workitems/edit/1",
    attachments: [],
  };
}

describe("applyTemplateAndRules", () => {
  it("fills all section keys", () => {
    const s = applyTemplateAndRules(sampleNormalized());
    expect(s.resumo).toContain("User Story");
    expect(s.perguntas.length).toBeGreaterThan(0);
    expect(s.checklist).toContain("[ ]");
  });
});
