/**
 * Strips HTML to plain text for prompts and markdown (server-side).
 * Removes script blocks first as a safety baseline.
 */
export function htmlFieldToPlainText(html: string | undefined | null): string {
  if (!html) return "";
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyles = noScripts.replace(/<style[\s\S]*?<\/style>/gi, "");
  const blocks = noStyles
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return blocks
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}
