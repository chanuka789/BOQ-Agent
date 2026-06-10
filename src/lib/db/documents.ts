import { getSql } from "@/lib/db/client";
import type {
  DocumentChunkRow,
  DocumentScheduleRow,
  ScheduleType
} from "@/lib/db/types";

export type ChunkInput = {
  pageNumber: number | null;
  chunkIndex: number;
  documentType: string | null;
  scope: string | null;
  discipline: string | null;
  section: string | null;
  sectionCode: string | null;
  measurementStandard: string | null;
  trade: string | null;
  drawingRef: string | null;
  revisionRef: string | null;
  sourceFileName: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};

export async function deleteFileChunks(fileId: string) {
  const sql = getSql();
  await sql`delete from document_chunks where file_id = ${fileId}`;
}

export async function insertChunksBulk(
  projectId: string,
  fileId: string,
  chunks: ChunkInput[]
) {
  if (chunks.length === 0) return;
  const sql = getSql() as any;

  const columns = [
    "project_id", "file_id", "page_number", "chunk_index", "document_type",
    "scope", "discipline", "section", "section_code", "measurement_standard",
    "trade", "drawing_ref", "revision_ref", "source_file_name", "char_count",
    "content", "metadata"
  ];

  const placeholders: string[] = [];
  const params: unknown[] = [];

  chunks.forEach((chunk, i) => {
    const offset = i * columns.length;
    const ph = columns.map((col, c) =>
      col === "metadata" ? `$${offset + c + 1}::jsonb` : `$${offset + c + 1}`
    );
    placeholders.push(`(${ph.join(", ")})`);
    params.push(
      projectId,
      fileId,
      chunk.pageNumber,
      chunk.chunkIndex,
      chunk.documentType,
      chunk.scope,
      chunk.discipline,
      chunk.section,
      chunk.sectionCode,
      chunk.measurementStandard,
      chunk.trade,
      chunk.drawingRef,
      chunk.revisionRef,
      chunk.sourceFileName,
      chunk.content.length,
      chunk.content,
      JSON.stringify(chunk.metadata ?? {})
    );
  });

  await sql.query(
    `insert into document_chunks (${columns.join(", ")}) values ${placeholders.join(", ")}`,
    params
  );
}

export async function deleteFileSchedules(fileId: string) {
  const sql = getSql();
  await sql`delete from document_schedules where file_id = ${fileId}`;
}

export async function insertSchedule(input: {
  projectId: string;
  fileId: string;
  scheduleType: ScheduleType;
  scope: string | null;
  discipline: string | null;
  drawingRef: string | null;
  pageNumber: number | null;
  sourceFileName: string | null;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}) {
  const sql = getSql();
  await sql`
    insert into document_schedules (
      project_id, file_id, schedule_type, scope, discipline, drawing_ref,
      page_number, source_file_name, columns, rows
    )
    values (
      ${input.projectId}, ${input.fileId}, ${input.scheduleType}, ${input.scope},
      ${input.discipline}, ${input.drawingRef}, ${input.pageNumber},
      ${input.sourceFileName}, ${JSON.stringify(input.columns)}::jsonb,
      ${JSON.stringify(input.rows)}::jsonb
    )
  `;
}

export async function getProjectChunkStats(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select
      count(*)::int as chunks,
      count(distinct file_id)::int as files,
      count(distinct scope)::int as scopes
    from document_chunks
    where project_id = ${projectId}
  `) as Array<{ chunks: number; files: number; scopes: number }>;
  return rows[0];
}

export async function getProjectSchedules(
  projectId: string
): Promise<DocumentScheduleRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from document_schedules where project_id = ${projectId}
    order by created_at desc
  `) as DocumentScheduleRow[];
  return rows;
}

export async function hasProcessedChunks(projectId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    select 1 from document_chunks where project_id = ${projectId} limit 1
  `) as Array<{ "?column?": number }>;
  return rows.length > 0;
}

/**
 * Layer 3 retrieval: fetch the chunks most relevant to an agent's scope/section,
 * ranked by simple keyword overlap with the trade/section title. No embeddings
 * yet — the embedding column is reserved for future RAG without schema change.
 */
export async function getRelevantChunks({
  projectId,
  scope,
  sectionCode,
  trade,
  keywords,
  limit = 16
}: {
  projectId: string;
  scope: string;
  sectionCode?: string | null;
  trade?: string | null;
  keywords: string[];
  limit?: number;
}): Promise<DocumentChunkRow[]> {
  const sql = getSql();
  // Pull a candidate set for the scope (plus general/unclassified), then rank.
  const candidates = (await sql`
    select * from document_chunks
    where project_id = ${projectId}
      and (scope = ${scope} or scope is null or scope = 'General')
    order by created_at
    limit 400
  `) as DocumentChunkRow[];

  if (candidates.length === 0) return [];

  const terms = [trade ?? "", ...keywords]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

  const scored = candidates.map((chunk) => {
    const hay = `${chunk.content} ${chunk.trade ?? ""} ${chunk.section ?? ""}`.toLowerCase();
    let score = 0;
    if (chunk.scope === scope) score += 3;
    if (sectionCode && chunk.section_code === sectionCode) score += 4;
    for (const term of terms) {
      if (hay.includes(term)) score += 1;
    }
    if (chunk.document_type === "schedule") score += 2;
    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}

export async function getSchedulesForScope(
  projectId: string,
  scope: string
): Promise<DocumentScheduleRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from document_schedules
    where project_id = ${projectId}
      and (scope = ${scope} or scope is null)
    order by created_at
    limit 20
  `) as DocumentScheduleRow[];
  return rows;
}
