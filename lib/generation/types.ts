import type { ParsedWorkItemRef } from "@/lib/ado/types";

export type NormalizedAttachment = {
  name: string;
  text: string;
  skippedReason?: string;
  error?: string;
};

export type NormalizedWorkItem = {
  ref: ParsedWorkItemRef;
  workItemId: number;
  workItemType: string;
  title: string;
  descriptionPlain: string;
  acceptanceCriteriaPlain: string;
  adoWebUrl?: string;
  attachments: NormalizedAttachment[];
};
