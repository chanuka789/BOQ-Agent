import "server-only";

// @ts-ignore - pdf-parse has no bundled types
import pdf from "pdf-parse";
import * as XLSX from "xlsx";
import { extractTextFromDocx } from "@/lib/documents/docx";

export type ExtractedPage = { pageNumber: number; text: string };
export type ExtractedSheet = { name: string; csv: string; rows: string[][] };
export type ExtractionKind = "pdf" | "excel" | "word" | "image" | "text" | "other";

export type StructuredExtraction = {
  kind: ExtractionKind;
  pages: ExtractedPage[];
  sheets: ExtractedSheet[];
  rawText: string;
};

function detectKind(mime: string, name: string): ExtractionKind {
  const ct = mime.toLowerCase();
  const n = name.toLowerCase();
  if (ct.includes("spreadsheet") || ct.includes("excel") || /\.(xlsx|xls|xlsm|csv)$/.test(n))
    return "excel";
  if (
    ct.includes("wordprocessingml") ||
    ct.includes("msword") ||
    /\.(docx|doc)$/.test(n)
  )
    return "word";
  if (ct.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/.test(n)) return "image";
  if (ct.includes("text") || n.endsWith(".txt")) return "text";
  return "other";
}

async function extractPdfPages(buffer: Buffer): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  try {
    await pdf(buffer, {
      // Capture per-page text so chunks keep their page number.
      pagerender: async (pageData: any) => {
        const content = await pageData.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        const text = content.items
          .map((item: { str: string }) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push({ pageNumber: pages.length + 1, text });
        return text;
      }
    });
  } catch (error) {
    console.error("PDF page extraction failed, falling back to full text:", error);
  }

  if (pages.length === 0) {
    // Fallback: single block.
    try {
      const data = await pdf(buffer);
      pages.push({ pageNumber: 1, text: (data.text || "").replace(/\s+/g, " ").trim() });
    } catch {
      /* leave empty */
    }
  }
  return pages;
}

function extractExcelSheets(buffer: Buffer): ExtractedSheet[] {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    return wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: ""
      }) as unknown as string[][];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return {
        name,
        csv,
        rows: rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
      };
    });
  } catch (error) {
    console.error("Excel extraction failed:", error);
    return [];
  }
}

export async function extractStructured(file: {
  storage_url: string;
  mime_type: string | null;
  file_name: string;
}): Promise<StructuredExtraction> {
  const empty: StructuredExtraction = { kind: "other", pages: [], sheets: [], rawText: "" };
  try {
    const resp = await fetch(file.storage_url);
    if (!resp.ok) return empty;
    const buffer = Buffer.from(await resp.arrayBuffer());
    const kind = detectKind(file.mime_type ?? resp.headers.get("content-type") ?? "", file.file_name);

    if (kind === "excel") {
      const sheets = extractExcelSheets(buffer);
      const rawText = sheets.map((s) => `Sheet: ${s.name}\n${s.csv}`).join("\n\n");
      return { kind, pages: [], sheets, rawText };
    }

    if (kind === "pdf") {
      const pages = await extractPdfPages(buffer);
      const rawText = pages.map((p) => p.text).join("\n\n");
      return { kind, pages, sheets: [], rawText };
    }

    if (kind === "word") {
      const rawText = file.file_name.toLowerCase().endsWith(".docx")
        ? await extractTextFromDocx(buffer)
        : buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r]/g, " ");
      return { kind, pages: [{ pageNumber: 1, text: rawText }], sheets: [], rawText };
    }

    if (kind === "text") {
      const rawText = buffer.toString("utf-8");
      return { kind, pages: [{ pageNumber: 1, text: rawText }], sheets: [], rawText };
    }

    // Images / drawings: text not extractable here (vision is a future layer).
    if (kind === "image") {
      return { kind, pages: [], sheets: [], rawText: "" };
    }

    const rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r]/g, " ");
    return { kind, pages: [{ pageNumber: 1, text: rawText }], sheets: [], rawText };
  } catch (error) {
    console.error(`Structured extraction failed for ${file.file_name}:`, error);
    return empty;
  }
}
