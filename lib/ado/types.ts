export type ParsedWorkItemRef = {
  host: "dev.azure.com" | "visualstudio.com";
  organization: string;
  project: string;
  workItemId: number;
};

export type WorkItemFields = Record<string, unknown>;

export type WorkItemRelation = {
  rel: string;
  url: string;
  attributes?: Record<string, unknown>;
};

export type AdoWorkItemResponse = {
  id: number;
  rev: number;
  url: string;
  fields: WorkItemFields;
  relations?: WorkItemRelation[];
};
