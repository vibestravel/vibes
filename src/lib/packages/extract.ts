// Text extraction for uploaded package documents (PDF, DOCX, PPTX, XLSX).
// Scanned PDFs/images with no text layer are flagged NEEDS_OCR (OCR is added in Phase 2).
import "server-only";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export const ACCEPTED: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export const MAX_BYTES = 25 * 1024 * 1024;

export function extOf(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }

export async function extractText(buf: Buffer, fileName: string): Promise<{ text: string; needsOcr: boolean }> {
  const ext = extOf(fileName);
  let text = "";
  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (ext === "xlsx") {
    const wb = XLSX.read(buf, { type: "buffer" });
    text = wb.SheetNames.map((n) => `## ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
  } else if (ext === "pptx") {
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
    const parts: string[] = [];
    for (const s of slides) {
      const xml = await zip.files[s].async("string");
      const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      parts.push(`## Slide ${s.match(/\d+/g)!.pop()}\n${decodeXml(runs.join(" "))}`);
    }
    text = parts.join("\n\n");
  } else if (["png", "jpg", "jpeg"].includes(ext)) {
    return { text: "", needsOcr: true };
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  const meaningful = text.replace(/[\s\d#|,.\-]/g, "").length;
  return { text, needsOcr: meaningful < 40 };
}

function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
