export function basicAuthHeader(pat: string): string {
  const token = pat.trim();
  if (!token) {
    throw new Error("PAT do Azure DevOps ausente.");
  }
  const b64 = Buffer.from(`:${token}`, "utf8").toString("base64");
  return `Basic ${b64}`;
}
