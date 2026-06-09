import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import {
  DEFAULT_QUALITY_MODE,
  MODEL_IDS,
  MODEL_LABELS,
  QUALITY_MODES,
  roleForTask,
  type AiTask,
  type ModelRole
} from "@/lib/ai/model-config";
import { getAiUsageTotals, getRecentAiUsage } from "@/lib/db/ai-usage";
import { requireCurrentAppUser } from "@/lib/db/users";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_ENV: Record<ModelRole, string> = {
  glm_flash: "AI_MODEL_GLM_FLASH",
  glm_free: "AI_MODEL_GLM_FREE",
  gemini_flash_lite: "AI_MODEL_GEMINI_FLASH_LITE",
  minimax_m3: "AI_MODEL_MINIMAX_M3",
  qwen_coder: "AI_MODEL_QWEN_CODER"
};

const ROLES: ModelRole[] = [
  "glm_flash",
  "glm_free",
  "gemini_flash_lite",
  "minimax_m3",
  "qwen_coder"
];

const TASKS: AiTask[] = [
  "document_classification",
  "scope_detection",
  "previous_boq_analysis",
  "knowledge_base_extraction",
  "boq_description_generation",
  "unit_checking",
  "assumption_generation",
  "query_rfi_generation",
  "section_agent_processing",
  "complex_section_generation",
  "final_boq_qa",
  "excel_export_preparation",
  "testing"
];

export default async function AiSettingsPage() {
  try {
    await requireCurrentAppUser();
    const [recent, totals] = await Promise.all([
      getRecentAiUsage(40).catch(() => []),
      getAiUsageTotals().catch(() => ({ calls: 0, estimated_cost: "0", failures: 0 }))
    ]);

    const apiConfigured = Boolean(process.env.OPENROUTER_API_KEY);

    return (
      <>
        <PageHeader
          title="AI models"
          description="Multi-model routing via OpenRouter. Configure model IDs and the default quality mode with environment variables — no code changes needed."
        />

        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">Status</h2>
              <div className="flex items-center gap-2">
                <Badge tone={apiConfigured ? "success" : "warning"}>
                  OPENROUTER_API_KEY {apiConfigured ? "set" : "missing"}
                </Badge>
                <Badge tone="info">Default mode: {DEFAULT_QUALITY_MODE}</Badge>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Total AI calls" value={String(totals.calls)} />
              <Stat
                label="Estimated cost"
                value={`$${Number(totals.estimated_cost).toFixed(4)}`}
              />
              <Stat label="Failed calls" value={String(totals.failures)} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Configured models
            </h2>
            <div className="mt-4 table-shell overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Model</th>
                    <th>Resolved OpenRouter ID</th>
                    <th>Env override</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => (
                    <tr key={role}>
                      <td className="font-mono text-xs">{role}</td>
                      <td className="font-semibold">{MODEL_LABELS[role]}</td>
                      <td className="font-mono text-xs">{MODEL_IDS[role]}</td>
                      <td>
                        <Badge tone={process.env[ROLE_ENV[role]] ? "success" : "neutral"}>
                          {process.env[ROLE_ENV[role]] ? "custom" : "default"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Task routing by quality mode
            </h2>
            <div className="mt-4 table-shell overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Task</th>
                    {QUALITY_MODES.map((mode) => (
                      <th key={mode} className="capitalize">
                        {mode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((task) => (
                    <tr key={task}>
                      <td className="font-mono text-xs">{task}</td>
                      {QUALITY_MODES.map((mode) => (
                        <td key={mode}>{MODEL_LABELS[roleForTask(task, mode)]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Recent AI usage
            </h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No AI calls logged yet. Costs appear here per task and model after a
                generation runs.
              </p>
            ) : (
              <div className="mt-4 table-shell overflow-x-auto">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Task</th>
                      <th>Model</th>
                      <th>Mode</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap text-xs">{formatDate(row.created_at)}</td>
                        <td className="font-mono text-xs">{row.task_type}</td>
                        <td className="font-mono text-xs">{row.model_name}</td>
                        <td>{row.quality_mode ?? "—"}</td>
                        <td className="text-xs">
                          {row.input_tokens + row.output_tokens}
                        </td>
                        <td className="text-xs">${Number(row.estimated_cost).toFixed(4)}</td>
                        <td>
                          <Badge tone={row.status === "success" ? "success" : "danger"}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="AI models" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
