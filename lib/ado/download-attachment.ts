import "server-only";

import { basicAuthHeader } from "./auth";

function isAllowedAttachmentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "dev.azure.com" ||
      h.endsWith(".visualstudio.com") ||
      h.endsWith(".blob.core.windows.net")
    );
  } catch {
    return false;
  }
}

export async function downloadAttachment(pat: string, attachmentUrl: string): Promise<ArrayBuffer> {
  if (!isAllowedAttachmentUrl(attachmentUrl)) {
    throw new Error("URL de anexo não permitida.");
  }

  const res = await fetch(attachmentUrl, {
    headers: {
      Authorization: basicAuthHeader(pat),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao baixar anexo (${res.status}): ${t.slice(0, 200)}`);
  }

  return await res.arrayBuffer();
}
