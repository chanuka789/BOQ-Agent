import { getSql } from "@/lib/db/client";
import type {
  AgentJobRow,
  BoqAssumptionRow,
  BoqItemRow,
  BoqQueryRow,
  ReviewStatus
} from "@/lib/db/types";

export async function getBoqItems(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_items
    where project_id = ${projectId}
    order by section, trade, item_no nulls last, created_at
  `) as BoqItemRow[];

  return rows;
}

export async function getBoqQueries(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_queries
    where project_id = ${projectId}
    order by created_at desc
  `) as BoqQueryRow[];

  return rows;
}

export async function getBoqAssumptions(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_assumptions
    where project_id = ${projectId}
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

export async function createGenerationJob(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    insert into agent_jobs (
      project_id,
      job_type,
      status,
      progress,
      current_step,
      message,
      estimated_cost_usd
    )
    values (
      ${projectId},
      'boq_generation',
      'queued',
      0,
      'Waiting for background worker',
      'Connect Inngest in production to process this queued generation job.',
      0
    )
    returning *
  `) as AgentJobRow[];

  return rows[0];
}
