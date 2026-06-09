import { getSql } from "@/lib/db/client";

export type AiUsageLogInput = {
  projectId?: string | null;
  generationId?: string | null;
  agentId?: string | null;
  taskType: string;
  modelName: string;
  qualityMode?: string | null;
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  status: "success" | "failed";
  errorMessage?: string | null;
  durationMs?: number | null;
};

export async function logAiUsage(input: AiUsageLogInput) {
  try {
    const sql = getSql();
    await sql`
      insert into ai_model_usage_logs (
        project_id, generation_id, agent_id, task_type, model_name, quality_mode,
        attempt, input_tokens, output_tokens, estimated_cost, status, error_message, duration_ms
      )
      values (
        ${input.projectId ?? null}, ${input.generationId ?? null}, ${input.agentId ?? null},
        ${input.taskType}, ${input.modelName}, ${input.qualityMode ?? null}, ${input.attempt},
        ${input.inputTokens}, ${input.outputTokens}, ${input.estimatedCost}, ${input.status},
        ${input.errorMessage ?? null}, ${input.durationMs ?? null}
      )
    `;
  } catch (error) {
    console.error("Failed to log AI usage:", error);
  }
}

export type AiUsageSummary = {
  generation_id: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
};

export async function getGenerationUsage(generationId: string) {
  const sql = getSql();
  const rows = (await sql`
    select
      count(*)::int as calls,
      coalesce(sum(input_tokens), 0)::int as input_tokens,
      coalesce(sum(output_tokens), 0)::int as output_tokens,
      coalesce(sum(estimated_cost), 0)::numeric as estimated_cost
    from ai_model_usage_logs
    where generation_id = ${generationId}
  `) as Array<{ calls: number; input_tokens: number; output_tokens: number; estimated_cost: string }>;
  return rows[0];
}

export async function getRecentAiUsage(limit = 50) {
  const sql = getSql();
  const rows = (await sql`
    select l.*, p.name as project_name
    from ai_model_usage_logs l
    left join projects p on p.id = l.project_id
    order by l.created_at desc
    limit ${limit}
  `) as Array<{
    id: string;
    project_name: string | null;
    generation_id: string | null;
    agent_id: string | null;
    task_type: string;
    model_name: string;
    quality_mode: string | null;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }>;
  return rows;
}

export async function getAiUsageTotals() {
  const sql = getSql();
  const rows = (await sql`
    select
      count(*)::int as calls,
      coalesce(sum(estimated_cost), 0)::numeric as estimated_cost,
      count(*) filter (where status = 'failed')::int as failures
    from ai_model_usage_logs
  `) as Array<{ calls: number; estimated_cost: string; failures: number }>;
  return rows[0];
}
