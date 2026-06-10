import "server-only";

import { getSql } from "@/lib/db/client";
import {
  ChunkInput,
  deleteFileChunks,
  deleteFileSchedules,
  insertChunksBulk,
  insertSchedule
} from "@/lib/db/documents";
import { classifyChunk, detectScheduleType } from "@/lib/documents/classify";
import { extractStructured } from "@/lib/documents/extract";
import { parseSchedule } from "@/lib/documents/schedules";
import { interpretDrawing } from "@/lib/documents/vision";
import { interpretPdfDrawingPages } from "@/lib/documents/pdf-vision";
import { embedTexts, isEmbeddingsEnabled } from "@/lib/ai/embeddings";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

const MAX_CHUNK_CHARS = 1400;
const MAX_SCHEDULES_PER_FILE = 8;

function splitText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_CHUNK_CHARS) return clean ? [clean] : [];
  const parts: string[] = [];
  const sentences = clean.split(/(?<=[.;])\s+/);
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).length > MAX_CHUNK_CHARS) {
      if (current) parts.push(current.trim());
      // Hard-split very long sentences.
      if (sentence.length > MAX_CHUNK_CHARS) {
        for (let i = 0; i < sentence.length; i += MAX_CHUNK_CHARS) {
          parts.push(sentence.slice(i, i + MAX_CHUNK_CHARS));
        }
        current = "";
      } else {
        current = sentence;
      }
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Layer 1 + Layer 2: extract a source file into structured, classified, tagged
 * chunks and structured schedules stored in document_chunks / document_schedules.
 */
export async function processProjectFile(
  project: Pick<ProjectRow, "id" | "measurement_standard" | "scope">,
  file: ProjectFileRow
): Promise<{ success: boolean; chunks: number; schedules: number; error?: string }> {
  const sql = getSql();
  try {
    await sql`update project_files set status = 'processing', updated_at = now() where id = ${file.id}`;

    const extraction = await extractStructured(file);

    const chunks: ChunkInput[] = [];
    let chunkIndex = 0;
    let schedulesStored = 0;

    const addChunks = (text: string, pageNumber: number | null) => {
      for (const piece of splitText(text)) {
        const cls = classifyChunk(piece, file.file_name, project.measurement_standard);
        chunks.push({
          pageNumber,
          chunkIndex: chunkIndex++,
          documentType: file.document_type ?? cls.documentType,
          scope: file.scope ?? cls.scope,
          discipline: cls.discipline,
          section: null,
          sectionCode: cls.sectionCode,
          measurementStandard: project.measurement_standard,
          trade: null,
          drawingRef: cls.drawingRef,
          revisionRef: cls.revisionRef,
          sourceFileName: file.file_name,
          content: piece,
          metadata: { kind: extraction.kind }
        });
      }
    };

    // Collect schedule-parse candidates while chunking, then parse them all in
    // parallel (each parse is an LLM call — sequential parsing was the slowest
    // part of processing).
    const scheduleJobs: Array<{
      type: NonNullable<ReturnType<typeof detectScheduleType>>;
      content: string;
      pageNumber: number | null;
    }> = [];

    // PDF pages
    for (const page of extraction.pages) {
      if (!page.text) continue;
      addChunks(page.text, page.pageNumber);
      if (scheduleJobs.length < MAX_SCHEDULES_PER_FILE) {
        const type = detectScheduleType(page.text);
        if (type) scheduleJobs.push({ type, content: page.text, pageNumber: page.pageNumber });
      }
    }

    // Excel sheets
    for (const sheet of extraction.sheets) {
      const sheetText = `Sheet ${sheet.name}\n${sheet.csv}`;
      addChunks(sheetText, null);
      if (scheduleJobs.length < MAX_SCHEDULES_PER_FILE) {
        const type = detectScheduleType(`${sheet.name} ${sheet.csv}`);
        if (type) scheduleJobs.push({ type, content: sheetText, pageNumber: null });
      }
    }

    if (chunks.length === 0 && extraction.kind === "pdf") {
      const cls = classifyChunk(file.file_name, file.file_name, project.measurement_standard);
      const interpreted = await interpretPdfDrawingPages(file, { projectId: project.id });
      if (interpreted) {
        addChunks(interpreted, 1);
        if (scheduleJobs.length < MAX_SCHEDULES_PER_FILE) {
          const type = detectScheduleType(interpreted);
          if (type) scheduleJobs.push({ type, content: interpreted, pageNumber: 1 });
        }
      } else {
        chunks.push({
          pageNumber: 1,
          chunkIndex: chunkIndex++,
          documentType: file.document_type ?? "drawing",
          scope: file.scope ?? cls.scope,
          discipline: cls.discipline,
          section: null,
          sectionCode: cls.sectionCode,
          measurementStandard: project.measurement_standard,
          trade: null,
          drawingRef: cls.drawingRef,
          revisionRef: cls.revisionRef,
          sourceFileName: file.file_name,
          content:
            `[Scanned or image-based PDF: ${file.file_name}] No selectable text was extracted. ` +
            "PDF page rendering/OCR was unavailable or failed; convert this drawing/specification PDF to page images for full AI measurement context.",
          metadata: { kind: "pdf", requiresOcr: true }
        });
      }
    }

    const parsedSchedules = await Promise.all(
      scheduleJobs.map(async (job) => ({
        job,
        parsed: await parseSchedule(job.type, job.content, { projectId: project.id })
      }))
    );
    for (const { job, parsed } of parsedSchedules) {
      if (parsed.rows.length === 0) continue;
      const { scope } = classifyChunk(job.content, file.file_name, project.measurement_standard);
      await insertSchedule({
        projectId: project.id,
        fileId: file.id,
        scheduleType: job.type,
        scope: file.scope ?? scope,
        discipline: null,
        drawingRef: null,
        pageNumber: job.pageNumber,
        sourceFileName: file.file_name,
        columns: parsed.columns,
        rows: parsed.rows
      });
      schedulesStored += 1;
    }

    // Image / drawing files: vision-based interpretation (best-effort).
    if (chunks.length === 0 && extraction.kind === "image") {
      const interpreted = await interpretDrawing(file, { projectId: project.id });
      if (interpreted) {
        addChunks(interpreted, 1);
        if (schedulesStored < MAX_SCHEDULES_PER_FILE) {
          const type = detectScheduleType(interpreted);
          if (type) {
            const parsed = await parseSchedule(type, interpreted, { projectId: project.id });
            if (parsed.rows.length > 0) {
              const { scope } = classifyChunk(interpreted, file.file_name, project.measurement_standard);
              await insertSchedule({
                projectId: project.id,
                fileId: file.id,
                scheduleType: type,
                scope: file.scope ?? scope,
                discipline: null,
                drawingRef: null,
                pageNumber: 1,
                sourceFileName: file.file_name,
                columns: parsed.columns,
                rows: parsed.rows
              });
              schedulesStored += 1;
            }
          }
        }
      } else {
        const cls = classifyChunk(file.file_name, file.file_name, project.measurement_standard);
        chunks.push({
          pageNumber: 1,
          chunkIndex: 0,
          documentType: "drawing",
          scope: file.scope ?? cls.scope,
          discipline: cls.discipline,
          section: null,
          sectionCode: cls.sectionCode,
          measurementStandard: project.measurement_standard,
          trade: null,
          drawingRef: cls.drawingRef,
          revisionRef: null,
          sourceFileName: file.file_name,
          content: `[Drawing image: ${file.file_name}] — enable VISION to interpret this drawing.`,
          metadata: { kind: "image", vision: true, storage_url: file.storage_url }
        });
      }
    }

    // Semantic search support: embed chunk content for RAG retrieval (opt-in).
    if (isEmbeddingsEnabled() && chunks.length > 0) {
      for (let i = 0; i < chunks.length; i += 50) {
        const batch = chunks.slice(i, i + 50);
        const vectors = await embedTexts(batch.map((c) => c.content));
        if (vectors) batch.forEach((c, j) => (c.embedding = vectors[j]));
      }
    }

    await deleteFileChunks(file.id);
    await deleteFileSchedules(file.id);
    await insertChunksBulk(project.id, file.id, chunks);

    await sql`update project_files set status = 'indexed', updated_at = now() where id = ${file.id}`;
    return { success: true, chunks: chunks.length, schedules: schedulesStored };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";
    console.error(`Document processing failed for ${file.file_name}:`, error);
    await sql`update project_files set status = 'failed', updated_at = now() where id = ${file.id}`.catch(
      () => {}
    );
    return { success: false, chunks: 0, schedules: 0, error: message };
  }
}

/** Process all source documents for a project that are not yet indexed.
 *  Files run in parallel (small pool) to keep large uploads fast. */
export async function processProjectDocuments(
  project: Pick<ProjectRow, "id" | "measurement_standard" | "scope">,
  files: ProjectFileRow[],
  options?: { force?: boolean }
): Promise<{ processed: number }> {
  const targets = files.filter(
    (f) => f.file_type === "source_document" && (options?.force || f.status !== "indexed")
  );
  let processed = 0;
  const poolSize = 3;
  for (let i = 0; i < targets.length; i += poolSize) {
    const batch = targets.slice(i, i + poolSize);
    const results = await Promise.all(batch.map((file) => processProjectFile(project, file)));
    processed += results.filter((r) => r.success).length;
  }
  return { processed };
}
