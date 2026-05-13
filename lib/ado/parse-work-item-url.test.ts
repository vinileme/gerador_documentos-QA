import { describe, expect, it } from "vitest";

import { parseWorkItemUrl, workItemRestBase } from "./parse-work-item-url";

describe("parseWorkItemUrl", () => {
  it("parses dev.azure.com edit links", () => {
    const ref = parseWorkItemUrl(
      "https://dev.azure.com/myorg/myproject/_workitems/edit/42",
    );
    expect(ref).toEqual({
      host: "dev.azure.com",
      organization: "myorg",
      project: "myproject",
      workItemId: 42,
    });
    expect(workItemRestBase(ref)).toBe("https://dev.azure.com/myorg/myproject");
  });

  it("parses dev.azure.com links with extra query", () => {
    const ref = parseWorkItemUrl(
      "https://dev.azure.com/myorg/myproject/_workitems/edit/7?view=details",
    );
    expect(ref.workItemId).toBe(7);
  });

  it("parses visualstudio.com edit links", () => {
    const ref = parseWorkItemUrl("https://contoso.visualstudio.com/Proj/_workitems/edit/99");
    expect(ref.host).toBe("visualstudio.com");
    expect(ref.organization).toBe("contoso");
    expect(ref.project).toBe("Proj");
    expect(ref.workItemId).toBe(99);
    expect(workItemRestBase(ref)).toBe("https://contoso.visualstudio.com/Proj");
  });

  it("rejects unsupported hosts", () => {
    expect(() => parseWorkItemUrl("https://example.com/a/b/_workitems/edit/1")).toThrow(
      /Host não suportado/,
    );
  });
});
