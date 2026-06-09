// @ts-ignore
import pdf from "pdf-parse";
import * as XLSX from "xlsx";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (error) {
    console.error("Error parsing PDF with pdf-parse:", error);
    // fallback to basic text extraction
    const raw = buffer.toString("utf-8");
    const readable = raw.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
    return readable.slice(0, 10000);
  }
}

export async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    return wb.SheetNames.map(
      (s) => `Sheet: ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`
    ).join("\n\n");
  } catch (error) {
    console.error("Error parsing Excel:", error);
    return "";
  }
}

export async function extractFileText(
  storageUrl: string,
  mimeType: string | null,
  fileName: string
): Promise<string> {
  try {
    const resp = await fetch(storageUrl);
    if (!resp.ok) return `[File: ${fileName} — fetch failed]`;

    const buffer = Buffer.from(await resp.arrayBuffer());
    const ct = (mimeType ?? resp.headers.get("content-type") ?? "").toLowerCase();
    const name = fileName.toLowerCase();

    if (
      ct.includes("spreadsheet") ||
      ct.includes("excel") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")
    ) {
      return await extractTextFromExcel(buffer);
    }

    if (ct.includes("pdf") || name.endsWith(".pdf")) {
      const parsed = await extractTextFromPdf(buffer);
      if (parsed.trim().length > 0) {
        return parsed;
      }
      return `[PDF: ${fileName} — no text extracted, possibly scanned drawing]`;
    }

    if (ct.includes("text") || name.endsWith(".txt") || name.endsWith(".csv")) {
      return buffer.toString("utf-8");
    }

    return `[File: ${fileName}, type: ${ct}]`;
  } catch (error) {
    console.error(`Error extracting text from file ${fileName}:`, error);
    return `[File: ${fileName} — extraction error]`;
  }
}

export type VisionPayload = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export function getVisionPayload(file: { storage_url: string; mime_type: string | null; file_name: string }): VisionPayload | null {
  const ct = (file.mime_type ?? "").toLowerCase();
  const name = file.file_name.toLowerCase();
  if (
    ct.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  ) {
    return {
      type: "image_url",
      image_url: {
        url: file.storage_url
      }
    };
  }
  return null;
}
