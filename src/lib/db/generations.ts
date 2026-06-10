import { getSql } from "@/lib/db/client";
import type {
  BoqGenerationAgentLogRow,
  BoqGenerationExportRow,
  BoqGenerationRow,
  BoqGenerationThoughtRow,
  AgentLogStatus,
  GenerationStatus
} from "@/lib/db/types";

/** Append a reasoning/thinking entry to the live generation feed. Best-effort. */
export async function addThought(input: {
  generationId: string;
  projectId: string;
  agentId: string;
  agentLabel: string;
  phase?: string | null;
  kind?: "thought" | "reasoning" | "status";
  thought: string;
}) {
  try {
    const sql = getSql();
    await sql`
      insert into boq_generation_thoughts (
        generation_id, project_id, agent_id, agent_label, phase, kind, thought
      )
      values (
        ${input.generationId}, ${input.projectId}, ${input.agentId}, ${input.agentLabel},
        ${input.phase ?? null}, ${input.kind ?? "thought"}, ${input.thought.slice(0, 4000)}
      )
    `;
  } catch (error) {
    console.error("Failed to add thought:", error);
  }
}

export async function getThoughts(
  generationId: string,
  limit = 250
): Promise<BoqGenerationThoughtRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from boq_generation_thoughts
    where generation_id = ${generationId}
    order by seq
    limit ${limit}
  `) as BoqGenerationThoughtRow[];
  return rows;
}

export async function createGeneration({
  projectId,
  label,
  measurementStandard,
  templateId,
  sourceFileIds,
  qualityMode = "balanced",
  createdBy
}: {
  projectId: string;
  label: string;
  measurementStandard: string;
  templateId?: string | null;
  sourceFileIds: string[];
  qualityMode?: string;
  createdBy?: string | null;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into boq_generations (
      project_id, label, measurement_standard, template_id, source_file_ids,
      quality_mode, status, created_by
    )
    values (
      ${projectId}, ${label}, ${measurementStandard}, ${templateId ?? null},
      ${JSON.stringify(sourceFileIds)}::jsonb, ${qualityMode}, 'queued', ${createdBy ?? null}
    )
    returning *
  `) as BoqGenerationRow[];
  return rows[0];
}

export async function getGenerations(
  projectId: string,
  options?: { includeDeleted?: boolean }
): Promise<BoqGenerationRow[]> {
  const sql = getSql();
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = (await sql`
    select *
    from boq_generations
    where project_id = ${projectId}
      and (${includeDeleted} or deleted_at is null)
    order by created_at desc
  `) as BoqGenerationRow[];
  return rows;
}

export async function getDeletedGenerationsForUser(
  userId: string
): Promise<Array<BoqGenerationRow & { project_name: string }>> {
  const sql = getSql();
  const rows = (await sql`
    select g.*, p.name as project_name
    from boq_generations g
    join projects p on p.id = g.project_id
    join project_members pm on pm.project_id = p.id
    where g.deleted_at is not null and pm.user_id = ${userId}
    order by g.deleted_at desc
  `) as Array<BoqGenerationRow & { project_name: string }>;
  return rows;
}

export async function getGeneration(generationId: string): Promise<BoqGenerationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from boq_generations where id = ${generationId} limit 1
  `) as BoqGenerationRow[];
  return rows[0] ?? null;
}

/**
 * Resolve the generation a page should display: an explicit id from the URL,
 * otherwise the latest active generation. Returns null id for legacy projects
 * that have no generation rows yet (callers then show all project data).
 */
export async function resolveGeneration(
  projectId: string,
  generationParam?: string | null
): Promise<{ generation: BoqGenerationRow | null; generationId: string | null }> {
  const generation = generationParam
    ? await getGeneration(generationParam)
    : await getLatestGeneration(projectId);
  const valid = generation && generation.project_id === projectId ? generation : null;
  return { generation: valid, generationId: valid?.id ?? null };
}

export async function getLatestGeneration(
  projectId: string
): Promise<BoqGenerationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_generations
    where project_id = ${projectId} and deleted_at is null
    order by created_at desc
    limit 1
  `) as BoqGenerationRow[];
  return rows[0] ?? null;
}

export async function updateGenerationStatus(
  generationId: string,
  status: GenerationStatus,
  counts?: {
    itemCount?: number;
    queryCount?: number;
    assumptionCount?: number;
    estimatedCostUsd?: number;
  }
) {
  const sql = getSql();
  await sql`
    update boq_generations
    set status = ${status},
        item_count = coalesce(${counts?.itemCount ?? null}, item_count),
        query_count = coalesce(${counts?.queryCount ?? null}, query_count),
        assumption_count = coalesce(${counts?.assumptionCount ?? null}, assumption_count),
        estimated_cost_usd = coalesce(${counts?.estimatedCostUsd ?? null}, estimated_cost_usd),
        updated_at = now()
    where id = ${generationId}
  `;
}

// ── Recycle bin ─────────────────────────────────────────────────────────────
export async function softDeleteGeneration(generationId: string) {
  const sql = getSql();
  await sql`update boq_generations set deleted_at = now(), updated_at = now() where id = ${generationId}`;
}

export async function restoreGeneration(generationId: string) {
  const sql = getSql();
  await sql`update boq_generations set deleted_at = null, updated_at = now() where id = ${generationId}`;
}

/**
 * Permanently delete a generation and everything linked by generation_id.
 * App-wide previous-BOQ knowledge is intentionally NOT touched.
 * Returns the storage URLs of export files so the caller can delete blobs.
 */
export async function permanentlyDeleteGeneration(
  generationId: string
): Promise<{ exportUrls: string[] }> {
  const sql = getSql();
  const exportRows = (await sql`
    select storage_url from boq_generation_exports where generation_id = ${generationId}
  `) as Array<{ storage_url: string | null }>;
  const exportUrls = exportRows
    .map((r) => r.storage_url)
    .filter((url): url is string => Boolean(url));

  // ON DELETE CASCADE on generation_id handles items, queries, assumptions,
  // agent_jobs, exports and agent logs. Delete the generation row last.
  await sql`delete from boq_generations where id = ${generationId}`;

  return { exportUrls };
}

// ── Exports ─────────────────────────────────────────────────────────────────
export async function recordGenerationExport({
  generationId,
  projectId,
  fileName,
  storageUrl,
  itemCount,
  createdBy
}: {
  generationId: string;
  projectId: string;
  fileName: string;
  storageUrl?: string | null;
  itemCount: number;
  createdBy?: string | null;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into boq_generation_exports (
      generation_id, project_id, file_name, storage_url, item_count, created_by
    )
    values (
      ${generationId}, ${projectId}, ${fileName}, ${storageUrl ?? null},
      ${itemCount}, ${createdBy ?? null}
    )
    returning *
  `) as BoqGenerationExportRow[];
  return rows[0];
}

export async function getGenerationExports(
  generationId: string
): Promise<BoqGenerationExportRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from boq_generation_exports
    where generation_id = ${generationId}
    order by created_at desc
  `) as BoqGenerationExportRow[];
  return rows;
}

// ── Per-agent run logs ──────────────────────────────────────────────────────
export async function upsertAgentLog({
  generationId,
  projectId,
  agentId,
  agentLabel,
  scope,
  sectionCode,
  status,
  progress,
  statusText,
  modelName,
  itemsCount,
  queriesCount,
  assumptionsCount,
  errorMessage
}: {
  generationId: string;
  projectId: string;
  agentId: string;
  agentLabel: string;
  scope?: string | null;
  sectionCode?: string | null;
  status: AgentLogStatus;
  progress?: number;
  statusText?: string | null;
  modelName?: string | null;
  itemsCount?: number;
  queriesCount?: number;
  assumptionsCount?: number;
  errorMessage?: string | null;
}) {
  const sql = getSql();
  const existing = (await sql`
    select id from boq_generation_agent_logs
    where generation_id = ${generationId} and agent_id = ${agentId}
    limit 1
  `) as Array<{ id: string }>;

  if (existing[0]) {
    await sql`
      update boq_generation_agent_logs
      set status = ${status},
          progress = coalesce(${progress ?? null}, progress),
          status_text = ${statusText ?? null},
          model_name = coalesce(${modelName ?? null}, model_name),
          items_count = coalesce(${itemsCount ?? null}, items_count),
          queries_count = coalesce(${queriesCount ?? null}, queries_count),
          assumptions_count = coalesce(${assumptionsCount ?? null}, assumptions_count),
          error_message = ${errorMessage ?? null},
          started_at = case when ${status} = 'running' and started_at is null then now() else started_at end,
          completed_at = case when ${status} in ('completed', 'skipped', 'failed') then now() else completed_at end,
          updated_at = now()
      where id = ${existing[0].id}
    `;
    return;
  }

  await sql`
    insert into boq_generation_agent_logs (
      generation_id, project_id, agent_id, agent_label, scope, section_code,
      status, progress, status_text, model_name, items_count, queries_count, assumptions_count,
      error_message, started_at, completed_at
    )
    values (
      ${generationId}, ${projectId}, ${agentId}, ${agentLabel}, ${scope ?? null},
      ${sectionCode ?? null}, ${status}, ${progress ?? 0}, ${statusText ?? null},
      ${modelName ?? null}, ${itemsCount ?? 0}, ${queriesCount ?? 0}, ${assumptionsCount ?? 0},
      ${errorMessage ?? null},
      case when ${status} = 'running' then now() else null end,
      case when ${status} in ('completed', 'skipped', 'failed') then now() else null end
    )
  `;
}

export async function getAgentLogs(
  generationId: string
): Promise<BoqGenerationAgentLogRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from boq_generation_agent_logs
    where generation_id = ${generationId}
    order by created_at
  `) as BoqGenerationAgentLogRow[];
  return rows;
}
