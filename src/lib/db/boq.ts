import { getSql } from "@/lib/db/client";
import type {
  AgentJobRow,
  BoqAssumptionRow,
  BoqItemRow,
  BoqQueryRow,
  JobStatus,
  ReviewStatus
} from "@/lib/db/types";

export async function getBoqItems(projectId: string, generationId?: string | null) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_items
    where project_id = ${projectId}
      and (${generationId ?? null}::uuid is null or generation_id = ${generationId ?? null})
    order by section, position
  `) as BoqItemRow[];

  return rows;
}

export async function getBoqQueries(projectId: string, generationId?: string | null) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_queries
    where project_id = ${projectId}
      and (${generationId ?? null}::uuid is null or generation_id = ${generationId ?? null})
    order by created_at desc
  `) as BoqQueryRow[];

  return rows;
}

export async function getBoqAssumptions(projectId: string, generationId?: string | null) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_assumptions
    where project_id = ${projectId}
      and (${generationId ?? null}::uuid is null or generation_id = ${generationId ?? null})
    order by created_at desc
  `) as BoqAssumptionRow[];

  return rows;
}

export async function getAgentJobs(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from agent_jobs
    where project_id = ${projectId}
    order by created_at desc
    limit 8
  `) as AgentJobRow[];

  return rows;
}

export async function updateBoqItemFields({
  itemId,
  userId,
  description,
  unit,
  reviewStatus
}: {
  itemId: string;
  userId: string;
  description?: string;
  unit?: string;
  reviewStatus?: ReviewStatus;
}) {
  const sql = getSql();
  const existingRows = (await sql`
    select id, project_id, description, unit, review_status
    from boq_items
    where id = ${itemId}
    limit 1
  `) as Pick<
    BoqItemRow,
    "id" | "project_id" | "description" | "unit" | "review_status"
  >[];

  const existing = existingRows[0];

  if (!existing) {
    throw new Error("BOQ item not found.");
  }

  const nextDescription = description ?? existing.description;
  const nextUnit = unit ?? existing.unit;
  const nextStatus = reviewStatus ?? existing.review_status;

  await sql`
    update boq_items
    set
      description = ${nextDescription},
      unit = ${nextUnit},
      review_status = ${nextStatus},
      updated_by = ${userId},
      updated_at = now()
    where id = ${itemId}
  `;

  const changedFields: string[] = [];

  if (nextDescription !== existing.description) {
    changedFields.push("description");
  }

  if (nextUnit !== existing.unit) {
    changedFields.push("unit");
  }

  if (nextStatus !== existing.review_status) {
    changedFields.push("review_status");
  }

  if (changedFields.length > 0) {
    await sql`
      insert into boq_item_revisions (
        boq_item_id,
        project_id,
        edited_by,
        old_values,
        new_values
      )
      values (
        ${itemId},
        ${existing.project_id},
        ${userId},
        ${JSON.stringify({
          description: existing.description,
          unit: existing.unit,
          review_status: existing.review_status
        })}::jsonb,
        ${JSON.stringify({
          description: nextDescription,
          unit: nextUnit,
          review_status: nextStatus
        })}::jsonb
      )
    `;

    if (nextDescription !== existing.description || nextUnit !== existing.unit) {
      await sql`
        insert into boq_corrections (
          boq_item_id,
          project_id,
          corrected_by,
          original_description,
          corrected_description,
          original_unit,
          corrected_unit
        )
        values (
          ${itemId},
          ${existing.project_id},
          ${userId},
          ${existing.description},
          ${nextDescription},
          ${existing.unit},
          ${nextUnit}
        )
      `;
    }
  }
}

export async function createGenerationJob(
  projectId: string,
  generationId?: string | null
) {
  const sql = getSql();
  const rows = (await sql`
    insert into agent_jobs (
      project_id,
      generation_id,
      job_type,
      status,
      progress,
      current_step,
      message,
      estimated_cost_usd
    )
    values (
      ${projectId},
      ${generationId ?? null},
      'boq_generation',
      'queued',
      0,
      'Queued — starting shortly',
      null,
      0
    )
    returning *
  `) as AgentJobRow[];

  return rows[0];
}

export async function updateAgentJob(
  jobId: string,
  fields: {
    status: JobStatus;
    currentStep: string;
    progress: number;
    message?: string | null;
    estimatedCostUsd?: number;
  }
) {
  const sql = getSql();
  await sql`
    update agent_jobs
    set
      status = ${fields.status},
      current_step = ${fields.currentStep},
      progress = ${fields.progress},
      message = ${fields.message ?? null},
      estimated_cost_usd = ${fields.estimatedCostUsd != null ? fields.estimatedCostUsd.toFixed(4) : null},
      started_at = case when ${fields.status} = 'running' and started_at is null then now() else started_at end,
      completed_at = case when ${fields.status} in ('completed', 'failed') then now() else completed_at end,
      updated_at = now()
    where id = ${jobId}
  `;
}

export async function insertBoqItem(
  projectId: string,
  item: {
    item_no?: string | null;
    section: string;
    trade: string;
    item_type: string;
    description: string;
    unit: string;
    source_reference?: string | null;
    confidence_score?: number;
    review_status?: ReviewStatus;
  }
) {
  const sql = getSql();
  await sql`
    insert into boq_items (
      project_id, item_no, section, trade, item_type, description, unit,
      source_reference, confidence_score, review_status, ai_generated
    )
    values (
      ${projectId},
      ${item.item_no ?? null},
      ${item.section},
      ${item.trade},
      ${item.item_type},
      ${item.description},
      ${item.unit},
      ${item.source_reference ?? null},
      ${item.confidence_score ?? 0.8},
      ${item.review_status ?? "draft"},
      true
    )
  `;
}

export async function insertBoqQuery(
  projectId: string,
  query: { issue: string; clarification_needed: string; source_reference?: string | null }
) {
  const sql = getSql();
  await sql`
    insert into boq_queries (project_id, issue, clarification_needed, source_reference, status)
    values (${projectId}, ${query.issue}, ${query.clarification_needed}, ${query.source_reference ?? null}, 'open')
  `;
}

export async function insertBoqAssumption(
  projectId: string,
  assumption: { assumption: string; source_reference?: string | null }
) {
  const sql = getSql();
  await sql`
    insert into boq_assumptions (project_id, assumption, source_reference)
    values (${projectId}, ${assumption.assumption}, ${assumption.source_reference ?? null})
  `;
}

export async function insertBoqItemsBulk(
  projectId: string,
  items: Array<{
    item_no?: string | null;
    section?: string;
    trade: string;
    item_type: string;
    description: string;
    unit: string;
    source_reference?: string | null;
    confidence_score?: number;
    review_status?: ReviewStatus;
  }>,
  generationId?: string | null
) {
  if (items.length === 0) return;
  const sql = getSql() as any;

  const columns = [
    "project_id", "generation_id", "item_no", "section", "trade", "item_type",
    "description", "unit", "source_reference", "confidence_score", "review_status",
    "ai_generated"
  ];

  const placeholders: string[] = [];
  const params: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const offset = i * columns.length;
    const itemPlaceholders = columns.map((_, colIdx) => `$${offset + colIdx + 1}`);
    placeholders.push(`(${itemPlaceholders.join(", ")})`);

    params.push(
      projectId,
      generationId ?? null,
      item.item_no ?? null,
      item.section ?? "Architecture + Internal Design",
      item.trade,
      item.item_type,
      item.description,
      item.unit === "-" ? "" : item.unit,
      item.source_reference ?? null,
      item.confidence_score ?? 0.8,
      item.review_status ?? "draft",
      true
    );
  }

  const queryStr = `
    insert into boq_items (${columns.join(", ")})
    values ${placeholders.join(", ")}
  `;

  await sql.query(queryStr, params);
}

export async function insertBoqQueriesBulk(
  projectId: string,
  queries: Array<{ issue: string; clarification_needed: string; source_reference?: string | null }>,
  generationId?: string | null
) {
  if (queries.length === 0) return;
  const sql = getSql() as any;

  const columns = ["project_id", "generation_id", "issue", "clarification_needed", "source_reference", "status"];
  const placeholders: string[] = [];
  const params: any[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const offset = i * columns.length;
    const qPlaceholders = columns.map((_, colIdx) => `$${offset + colIdx + 1}`);
    placeholders.push(`(${qPlaceholders.join(", ")})`);

    params.push(
      projectId,
      generationId ?? null,
      q.issue,
      q.clarification_needed,
      q.source_reference ?? null,
      "open"
    );
  }

  const queryStr = `
    insert into boq_queries (${columns.join(", ")})
    values ${placeholders.join(", ")}
  `;

  await sql.query(queryStr, params);
}

export async function insertBoqAssumptionsBulk(
  projectId: string,
  assumptions: Array<{ assumption: string; source_reference?: string | null }>,
  generationId?: string | null
) {
  if (assumptions.length === 0) return;
  const sql = getSql() as any;

  const columns = ["project_id", "generation_id", "assumption", "source_reference"];
  const placeholders: string[] = [];
  const params: any[] = [];

  for (let i = 0; i < assumptions.length; i++) {
    const a = assumptions[i];
    const offset = i * columns.length;
    const aPlaceholders = columns.map((_, colIdx) => `$${offset + colIdx + 1}`);
    placeholders.push(`(${aPlaceholders.join(", ")})`);

    params.push(
      projectId,
      generationId ?? null,
      a.assumption,
      a.source_reference ?? null
    );
  }

  const queryStr = `
    insert into boq_assumptions (${columns.join(", ")})
    values ${placeholders.join(", ")}
  `;

  await sql.query(queryStr, params);
}

