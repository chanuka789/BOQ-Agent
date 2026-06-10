import "server-only";

import { runAiJson } from "@/lib/ai/run";
import { isVisionEnabled } from "@/lib/documents/vision";

/* eslint-disable no-new-func */

type RenderedPdfPage = {
  pageNumber: number;
  dataUrl: string;
};

async function optionalImport<T>(specifier: string): Promise<T> {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<T>;
  return importer(specifier);
}

async function renderPdfPages(
  buffer: Buffer,
  maxPages: number
): Promise<RenderedPdfPage[]> {
  const pdfjs = await optionalImport<any>("pdfjs-dist/legacy/build/pdf.mjs");
  const canvas = await optionalImport<any>("@napi-rs/canvas");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false
  });
  const pdf = await loadingTask.promise;
  const pages: RenderedPdfPage[] = [];
  const pageCount = Math.min(pdf.numPages ?? 0, maxPages);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const bitmap = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = bitmap.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({ pageNumber, dataUrl: bitmap.toDataURL("image/png") });
  }

  await pdf.destroy?.();
  return pages;
}

function maxPdfVisionPages(): number {
  const value = Number(process.env.PDF_VISION_MAX_PAGES);
  return Math.max(1, Math.min(5, Number.isFinite(value) && value > 0 ? value : 3));
}

export async function interpretPdfDrawingPages(
  file: { storage_url: string; file_name: string },
  context?: { projectId?: string | null }
): Promise<string | null> {
  if (!isVisionEnabled()) return null;

  try {
    const response = await fetch(file.storage_url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const pages = await renderPdfPages(buffer, maxPdfVisionPages());
    if (pages.length === 0) return null;

    const result = await runAiJson<{ text: string }>({
      task: "drawing_interpretation",
      maxTokens: 3500,
      context: { projectId: context?.projectId ?? null, agentId: "pdf-vision" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `You are a Quantity Surveyor reading rendered pages from scanned/image-based PDF ${file.file_name}. ` +
                "Extract all measurement-useful text: title blocks, drawing numbers, revisions, notes, legends, " +
                "schedules, room labels, dimensions and references. Do not invent anything. " +
                'Return strict JSON {"text": "..."} and prefix page-specific findings with the page number.'
            },
            ...pages.flatMap((page) => [
              { type: "text", text: `Page ${page.pageNumber}` },
              {
                type: "image_url",
                image_url: { url: page.dataUrl }
              }
            ])
          ]
        }
      ]
    });

    const text = result.data?.text;
    return text && text.trim().length > 0 ? text.trim() : null;
  } catch (error) {
    console.error(`Scanned PDF vision failed for ${file.file_name}:`, error);
    return null;
  }
}
