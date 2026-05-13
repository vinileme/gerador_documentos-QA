import { describe, expect, it } from "vitest";

import { jobResultStore } from "./store";
import { reportPayloadSchema } from "@/lib/schemas/report-payload";

describe("jobResultStore", () => {
  it("stores and retrieves done payload", () => {
    const jobId = "test-job-1";
    const payload = reportPayloadSchema.parse({
      version: 1,
      structured: {
        resumo: "a",
        objetivoNegocio: "b",
        escopo: "c",
        foraEscopo: "d",
        regras: "e",
        suposicoes: "f",
        gherkin: "g",
        testesFuncionais: "h",
        negativos: "i",
        borda: "j",
        uiux: "k",
        integracao: "l",
        riscos: "m",
        perguntas: "n",
        checklist: "o",
      },
      markdown: "# x",
      meta: {
        workItemId: 1,
        workItemType: "User Story",
        title: "t",
        generatedAt: new Date().toISOString(),
        warnings: [],
      },
      provenance: { fromAdo: { titulo: "t" } },
    });

    jobResultStore.set(jobId, { status: "done", payload });
    const got = jobResultStore.get(jobId);
    expect(got?.status).toBe("done");
    if (got?.status === "done") {
      expect(got.payload.meta.workItemId).toBe(1);
    }
  });
});
