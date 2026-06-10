import "server-only";

import { resolveScope, SCOPES } from "@/lib/agents/catalog";
import { runAiJson } from "@/lib/ai/run";
import type { QualityMode } from "@/lib/ai/model-config";
import { getSql } from "@/lib/db/client";
import type { ProjectBrief, ProjectBriefRow, ProjectRow } from "@/lib/db/types";

const SCOPE_NAMES = SCOPES.map((s) => s.scope);

/**
 * Lead-coordinator reasoning pass. Reads compact summaries of the processed
 * documents (titles, drawing refs, first content of each file) and schedules,
 * then produces a structured project brief: project/client details, a drawing
 * register with each drawing's scope, the disciplines present, and a per-scope
 * coverage plan used to coordinate the section agents and check for missed items.
 */
export async function buildProjectBrief({
  project,
  generationId,
  mode
}: {
  project: Pick<ProjectRow, "id" | "name" | "client_name" | "project_type" | "scope" | "measurement_standard">;
  generationId: string | null;
  mode: QualityMode;
}): Promise<ProjectBrief | null> {
  const sql = getSql();

  // Compact per-file summary (first chunks + drawing refs) — not whole documents.
  const chunkRows = (await sql`
    select source_file_name, document_type, scope, drawing_ref, revision_ref, content, chunk_index
    from document_chunks
    where project_id = ${project.id}
    order by source_file_name, chunk_index
    limit 400
  `) as Array<{
    source_file_name: string | null;
    document_type: string | null;
    scope: string | null;
    drawing_ref: string | null;
    revision_ref: string | null;
    content: string;
    chunk_index: number;
  }>;

  if (chunkRows.length === 0) return null;

  const byFile = new Map<string, { types: Set<string>; scopes: Set<string>; refs: Set<string>; sample: string }>();
  for (const row of chunkRows) {
    const key = row.source_file_name ?? "unknown";
    if (!byFile.has(key)) {
      byFile.set(key, { types: new Set(), scopes: new Set(), refs: new Set(), sample: "" });
    }
    const entry = byFile.get(key)!;
    if (row.document_type) entry.types.add(row.document_type);
    if (row.scope) entry.scopes.add(row.scope);
    if (row.drawing_ref) entry.refs.add(row.drawing_ref);
    if (!entry.sample && row.chunk_index === 0) entry.sample = row.content.slice(0, 400);
  }

  const fileSummaries = Array.from(byFile.entries())
    .slice(0, 60)
    .map(
      ([name, e]) =>
        `FILE: ${name}\n  types: ${[...e.types].join(", ") || "?"}; scopes: ${[...e.scopes].join(", ") || "?"}; refs: ${[...e.refs].slice(0, 8).join(", ") || "—"}\n  sample: ${e.sample}`
    )
    .join("\n\n");

  const scheduleRows = (await sql`
    select schedule_type, source_file_name, scope from document_schedules where project_id = ${project.id} limit 40
  `) as Array<{ schedule_type: string; source_file_name: string | null; scope: string | null }>;
  const scheduleSummary = scheduleRows
    .map((s) => `- ${s.schedule_type} schedule (${s.source_file_name ?? "?"}, scope ${s.scope ?? "?"})`)
    .join("\n");

  try {
    const result = await runAiJson<ProjectBrief>({
      task: "project_understanding",
      mode,
      maxTokens: 3500,
      context: { projectId: project.id, generationId, agentId: "coordinator" },
      messages: [
        {
          role: "system",
          content:
            "You are the LEAD Quantity Surveyor coordinating a Bill of Quantities. " +
            "From the document summaries, understand the project and produce a coordination brief. " +
            `Identify the project name and client; build a drawing register where each drawing has a name/number and its SCOPE chosen from: ${SCOPE_NAMES.join(", ")} ` +
            "(map drawing types like finishes, facade/cladding, structure, MEP, landscape to those scopes); " +
            "list the disciplines/scopes that are actually present; and build a coverage_plan that, for each present scope, lists the concrete expected work items to be measured. " +
            'Return strict JSON: {"project_name","client_name","project_type","drawings":[{"name","number","discipline","scope","covers"}],"scopes_present":[],"coverage_plan":[{"scope","expected_work":[]}],"notes"}. ' +
            "Only include scopes with real evidence in the documents. Do not invent drawings."
        },
        {
          role: "user",
          content:
            `Project (declared): ${project.name} for ${project.client_name}; type ${project.project_type}; scope ${project.scope}; method ${project.measurement_standard}.\n\n` +
            `Document summaries:\n${fileSummaries}\n\n` +
            (scheduleSummary ? `Schedules detected:\n${scheduleSummary}\n\n` : "") +
            "Return the coordination brief as strict JSON."
        }
      ]
    });

    const brief = normalizeBrief(result.data);

    await sql`
      insert into project_briefs (project_id, generation_id, brief)
      values (${project.id}, ${generationId}, ${JSON.stringify(brief)}::jsonb)
      on conflict (generation_id) do update set brief = excluded.brief, updated_at = now()
    `;

    return brief;
  } catch (error) {
    console.error("Project understanding pass failed:", error);
    return null;
  }
}

function normalizeBrief(brief: ProjectBrief): ProjectBrief {
  // Snap scopes to the known catalog so they line up with the section agents.
  const scopes = Array.from(
    new Set((brief.scopes_present ?? []).map((s) => resolveScope(s).scope).filter((s) => s !== "General"))
  );
  const coverage = (brief.coverage_plan ?? [])
    .map((c) => ({ scope: resolveScope(c.scope).scope, expected_work: c.expected_work ?? [] }))
    .filter((c) => c.scope !== "General");
  return { ...brief, scopes_present: scopes, coverage_plan: coverage };
}

export async function getProjectBrief(generationId: string): Promise<ProjectBrief | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from project_briefs where generation_id = ${generationId} limit 1
  `) as ProjectBriefRow[];
  return rows[0]?.brief ?? null;
}

/** Coverage check (no missed items): compare the coverage plan against the
 *  generated item descriptions and return queries for expected work not found. */
export function findCoverageGaps(
  brief: ProjectBrief,
  items: Array<{ trade: string; description: string }>
): Array<{ issue: string; clarification_needed: string; source_reference: string | null }> {
  const plan = brief.coverage_plan ?? [];
  if (plan.length === 0) return [];

  const haystack = items
    .map((i) => `${i.trade} ${i.description}`.toLowerCase())
    .join(" \n ");

  const gaps: Array<{ issue: string; clarification_needed: string; source_reference: string | null }> = [];
  for (const entry of plan) {
    for (const expected of entry.expected_work ?? []) {
      const terms = expected
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3);
      if (terms.length === 0) continue;
      const matched = terms.filter((t) => haystack.includes(t)).length;
      // Consider it covered if at least half the key terms appear.
      if (matched / terms.length < 0.5) {
        gaps.push({
          issue: `Possible missed item (${entry.scope}): "${expected}"`,
          clarification_needed:
            "Coverage check: the lead coordinator expected this work from the documents but it was not found in the generated BOQ. Confirm whether it applies and add it if so.",
          source_reference: null
        });
      }
    }
    if (gaps.length >= 30) break;
  }
  return gaps.slice(0, 30);
}

/** Build a short coverage note for one scope's agent, from the brief. */
export function briefNoteForScope(brief: ProjectBrief | null, scope: string): string {
  if (!brief) return "";
  const entry = (brief.coverage_plan ?? []).find((c) => c.scope === scope);
  const drawings = (brief.drawings ?? [])
    .filter((d) => d.scope && resolveScope(d.scope).scope === scope)
    .map((d) => [d.number, d.name].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 12);

  const parts: string[] = [];
  if (entry && entry.expected_work.length > 0) {
    parts.push(`Planned coverage for ${scope}: ${entry.expected_work.slice(0, 20).join("; ")}.`);
  }
  if (drawings.length > 0) {
    parts.push(`Relevant drawings: ${drawings.join(", ")}.`);
  }
  return parts.join(" ");
}
