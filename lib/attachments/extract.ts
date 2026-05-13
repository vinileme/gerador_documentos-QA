import "server-only";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

export type ExtractOutcome =
  | { kind: "ok"; text: string }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; message: string };

const EXT = {
  pdf: [".pdf"],
  docx: [".docx"],
  xlsx: [".xlsx"],
};

function extOf(name: string): "pdf" | "docx" | "xlsx" | "other" {
  const n = name.toLowerCase();
  if (EXT.pdf.some((e) => n.endsWith(e))) return "pdf";
  if (EXT.docx.some((e) => n.endsWith(e))) return "docx";
  if (EXT.xlsx.some((e) => n.endsWith(e))) return "xlsx";
  return "other";
}

async function extractPdf(buffer: ArrayBuffer): Promise<ExtractOutcome> {
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: Buffer.from(buffer) });
    const data = await parser.getText();
    return { kind: "ok", text: (data.text ?? "").trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: "error", message: `PDF: ${msg}` };
  } finally {
    try {
      await parser?.destroy();
    } catch {
      // ignore
    }
  }
}

async function extractDocx(buffer: ArrayBuffer): Promise<ExtractOutcome> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const text = (result.value ?? "").trim();
    const warn =
      result.messages?.map((m) => m.message).join("; ") || undefined;
    return { kind: "ok", text: warn ? `${text}\n\n(Avisos DOCX: ${warn})` : text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: "error", message: `DOCX: ${msg}` };
  }
}

function extractXlsx(buffer: ArrayBuffer): ExtractOutcome {
  try {
    const wb = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: true });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames.slice(0, 5)) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
      parts.push(`## Planilha: ${sheetName}\n${csv}`.trim());
    }
    if (wb.SheetNames.length > 5) {
      parts.push(`(Demais planilhas omitidas: ${wb.SheetNames.length - 5})`);
    }
    return { kind: "ok", text: parts.join("\n\n").trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: "error", message: `XLSX: ${msg}` };
  }
}

export function classifyAttachment(name: string): "pdf" | "docx" | "xlsx" | "other" {
  return extOf(name);
}

export async function extractAttachment(name: string, buffer: ArrayBuffer): Promise<ExtractOutcome> {
  const kind = extOf(name);
  if (kind === "other") {
    return { kind: "skipped", reason: "Formato de anexo não suportado (use PDF, DOCX ou XLSX)." };
  }
  if (kind === "pdf") return extractPdf(buffer);
  if (kind === "docx") return extractDocx(buffer);
  return extractXlsx(buffer);
}
