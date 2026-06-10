import "server-only";

import { embedOne, isEmbeddingsEnabled } from "@/lib/ai/embeddings";
import {
  getRelevantChunks,
  getRelevantChunksByEmbedding,
  getSchedulesForScope
} from "@/lib/db/documents";
import type { DocumentChunkRow } from "@/lib/db/types";

export type AgentContext = {
  hasContent: boolean;
  contextText: string;
  refs: string[];
  chunkCount: number;
  scheduleCount: number;
};

/**
 * Layer 3 — Agent Retrieval. Build a compact, scope-specific context package for
 * one section agent instead of passing whole documents. Returns the relevant
 * chunks and structured schedules plus the source references for traceability.
 * Designed so semantic/RAG retrieval can replace the keyword ranking later.
 */
export async function getAgentContext({
  projectId,
  scope,
  sectionCode,
  trade,
  keywords = [],
  maxChunks = 16
}: {
  projectId: string;
  scope: string;
  sectionCode?: string | null;
  trade?: string | null;
  keywords?: string[];
  maxChunks?: number;
}): Promise<AgentContext> {
  // Semantic (RAG) retrieval when embeddings are enabled; keyword ranking
  // otherwise (or when the query can't be embedded / returns nothing).
  let chunks: DocumentChunkRow[] = [];
  if (isEmbeddingsEnabled()) {
    const query = [scope, sectionCode ?? "", trade ?? "", ...keywords]
      .filter(Boolean)
      .join(" ");
    const queryEmbedding = await embedOne(query);
    if (queryEmbedding) {
      chunks = await getRelevantChunksByEmbedding({
        projectId,
        scope,
        queryEmbedding,
        limit: maxChunks
      });
    }
  }
  if (chunks.length === 0) {
    chunks = await getRelevantChunks({ projectId, scope, sectionCode, trade, keywords, limit: maxChunks });
  }
  const schedules = await getSchedulesForScope(projectId, scope);

  if (chunks.length === 0 && schedules.length === 0) {
    return { hasContent: false, contextText: "", refs: [], chunkCount: 0, scheduleCount: 0 };
  }

  const refs = new Set<string>();

  const scheduleBlocks = schedules.slice(0, 6).map((s) => {
    if (s.source_file_name) refs.add(s.source_file_name);
    const rows = (s.rows ?? []).slice(0, 60);
    return (
      `[${s.schedule_type.toUpperCase()} SCHEDULE${s.source_file_name ? ` — ${s.source_file_name}` : ""}` +
      `${s.drawing_ref ? `, DWG ${s.drawing_ref}` : ""}]\n` +
      `columns: ${(s.columns ?? []).join(", ")}\n` +
      JSON.stringify(rows)
    );
  });

  const chunkBlocks = chunks.map((c, i) => {
    const refParts = [
      c.source_file_name,
      c.drawing_ref ? `DWG ${c.drawing_ref}` : null,
      c.page_number ? `p.${c.page_number}` : null,
      c.revision_ref ? `Rev ${c.revision_ref}` : null
    ].filter(Boolean);
    const ref = refParts.join(", ");
    if (ref) refs.add(ref);
    return `[SOURCE ${i + 1}${ref ? ` — ${ref}` : ""}]\n${c.content}`;
  });

  const contextText = [...scheduleBlocks, ...chunkBlocks].join("\n\n");
  return {
    hasContent: true,
    contextText,
    refs: Array.from(refs),
    chunkCount: chunks.length,
    scheduleCount: schedules.length
  };
}
