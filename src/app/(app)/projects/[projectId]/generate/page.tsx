import { Download, Play, Sparkles, Table2, Trash2 } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getAgentJobs } from "@/lib/db/boq";
import { getProjectFiles } from "@/lib/db/files";
import { getAgentLogs, getGenerations } from "@/lib/db/generations";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { getProjectBrief } from "@/lib/generation/project-brief";
import { formatDate } from "@/lib/format";
import type { AgentLogStatus, BoqGenerationAgentLogRow, ProjectBrief } from "@/lib/db/types";
import { moveGenerationToRecycleBinAction } from "@/app/(app)/recycle-bin/actions";
import { queueGenerationAction } from "./actions";

export default async function GeneratePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, files, templates, rules, generations] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getProjectFiles(projectId),
      getProjectTemplates(projectId),
      getRules({ projectId }),
      getGenerations(projectId)
    ]);
    const sourceFiles = files.filter((file) => file.file_type === "source_document");

    const latest = generations[0] ?? null;
    const [agentLogs, brief, jobs] = latest
      ? await Promise.all([
          getAgentLogs(latest.id).catch(() => []),
          getProjectBrief(latest.id).catch(() => null),
          getAgentJobs(projectId).catch(() => [])
        ])
      : [[], null, []];
    const isRunning =
      latest?.status === "running" || latest?.status === "queued";
    const currentStep = jobs[0]?.current_step ?? null;

    return (
      <>
        {isRunning ? <AutoRefresh /> : null}
        <PageHeader
          title="Generate BOQ"
          description="Each run creates a separate, stored generation. Old generations are never overwritten."
          action={
            <form action={queueGenerationAction} className="flex items-end gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="text"
                name="label"
                placeholder="Generation label (optional)"
                className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
              />
              <select
                name="qualityMode"
                defaultValue="balanced"
                className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
                title="AI quality mode"
              >
                <option value="economy">Economy</option>
                <option value="balanced">Balanced</option>
                <option value="premium">Premium</option>
              </select>
              <button className="btn btn-primary" type="submit">
                <Play size={16} aria-hidden="true" />
                New generation
              </button>
            </form>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <ReadinessCard label="Source documents" value={sourceFiles.length} />
          <ReadinessCard label="BOQ templates" value={templates.length} />
          <ReadinessCard label="Unit rules" value={rules.length} />
          <ReadinessCard label="Generations" value={generations.length} />
        </div>

        {/* Lead coordinator project understanding */}
        {brief ? <ProjectBriefPanel brief={brief} /> : null}

        {/* Live agent status for the most recent generation */}
        {latest ? (
          <section className="panel mt-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  {latest.label} — live agent status
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {project.measurement_standard} · {latest.item_count} items ·{" "}
                  {latest.query_count} queries · {latest.assumption_count} assumptions
                </p>
              </div>
              <GenerationStatusBadge status={latest.status} />
            </div>

            <div className="mt-4">
              <OverallProgress logs={agentLogs} status={latest.status} />
            </div>

            {agentLogs.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <AgentCountChip label="Running" tone="warning" logs={agentLogs} match="running" />
                <AgentCountChip label="Completed" tone="success" logs={agentLogs} match="completed" />
                <AgentCountChip label="Skipped" tone="neutral" logs={agentLogs} match="skipped" />
                <AgentCountChip label="Failed" tone="danger" logs={agentLogs} match="failed" />
                <AgentCountChip label="Waiting" tone="info" logs={agentLogs} match="waiting" />
              </div>
            ) : null}

            {agentLogs.length > 0 ? (
              <div className="mt-4 space-y-2">
                {agentLogs.map((log) => (
                  <AgentRow key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {isRunning
                  ? currentStep ?? "Starting coordinator…"
                  : "No agent activity recorded for this generation."}
              </p>
            )}

            {agentLogs.length > 0 ? <ProcessingLog logs={agentLogs} /> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="btn btn-secondary" href={`/projects/${projectId}/boq-review?generation=${latest.id}`}>
                <Table2 size={15} aria-hidden="true" />
                Review BOQ
              </Link>
              <Link className="btn btn-secondary" href={`/projects/${projectId}/export?generation=${latest.id}`}>
                <Download size={15} aria-hidden="true" />
                Export
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              All generations
            </h2>
            <Badge>{generations.length}</Badge>
          </div>
          {generations.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No generations yet"
              description="Start a generation when source documents, templates, and rules are ready. Each run is stored separately so you can keep multiple BOQ drafts per project."
            />
          ) : (
            <div className="table-shell overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Generation</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((generation) => (
                    <tr key={generation.id}>
                      <td className="font-semibold text-[var(--foreground)]">
                        {generation.label}
                      </td>
                      <td>{generation.measurement_standard}</td>
                      <td>
                        <GenerationStatusBadge status={generation.status} />
                      </td>
                      <td>{generation.item_count}</td>
                      <td>{formatDate(generation.created_at)}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Link
                            className="font-bold text-[var(--primary)]"
                            href={`/projects/${projectId}/boq-review?generation=${generation.id}`}
                          >
                            Review
                          </Link>
                          <a
                            className="font-bold text-[var(--primary)]"
                            href={`/api/export/${projectId}?generation=${generation.id}`}
                          >
                            Export
                          </a>
                          <form action={moveGenerationToRecycleBinAction}>
                            <input type="hidden" name="generationId" value={generation.id} />
                            <button
                              className="inline-flex items-center gap-1 font-bold text-[var(--danger)]"
                              type="submit"
                              title="Move to Recycle Bin"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Generate BOQ" description="Queue an AI drafting job." />
        <SetupRequired error={error} />
      </>
    );
  }
}

function OverallProgress({
  logs,
  status
}: {
  logs: BoqGenerationAgentLogRow[];
  status: string;
}) {
  // The export agent runs on-demand at download time, so exclude it from the
  // section-generation progress (it stays "waiting" until the user exports).
  const scored = logs.filter((log) => log.agent_id !== "export-agent");
  let percent = status === "completed" || status === "exported" ? 100 : 0;
  if (scored.length > 0 && percent !== 100) {
    percent = Math.round(
      scored.reduce((acc, log) => acc + (log.status === "skipped" ? 100 : log.progress), 0) /
        scored.length
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Overall progress</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-2 rounded-full bg-[var(--primary)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AgentCountChip({
  label,
  tone,
  logs,
  match
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  logs: BoqGenerationAgentLogRow[];
  match: AgentLogStatus;
}) {
  const count = logs.filter((log) => log.status === match).length;
  if (count === 0) return null;
  return (
    <Badge tone={tone}>
      {label}: {count}
    </Badge>
  );
}

function ProcessingLog({ logs }: { logs: BoqGenerationAgentLogRow[] }) {
  const entries = [...logs]
    .filter((log) => log.status_text)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 30);

  if (entries.length === 0) return null;

  return (
    <details className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <summary className="cursor-pointer text-sm font-extrabold text-[var(--foreground)]">
        Processing log
      </summary>
      <ul className="mt-3 space-y-1.5 font-mono text-xs text-[var(--muted)]">
        {entries.map((log) => (
          <li key={`${log.id}-${log.updated_at}`} className="flex gap-2">
            <span className="shrink-0 text-[var(--foreground)]">
              {new Date(log.updated_at).toLocaleTimeString()}
            </span>
            <span className="shrink-0 font-bold">[{log.status}]</span>
            <span>
              {log.agent_label}: {log.status_text}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AgentRow({ log }: { log: BoqGenerationAgentLogRow }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--foreground)]">{log.agent_label}</span>
        <div className="flex items-center gap-2">
          {log.model_name ? (
            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--muted)]">
              {log.model_name}
            </span>
          ) : null}
          <AgentStatusBadge status={log.status} progress={log.progress} />
        </div>
      </div>
      {log.status_text ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{log.status_text}</p>
      ) : null}
      {log.error_message ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{log.error_message}</p>
      ) : null}
    </div>
  );
}

function AgentStatusBadge({
  status,
  progress
}: {
  status: AgentLogStatus;
  progress: number;
}) {
  const tone =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "skipped"
          ? "neutral"
          : status === "running"
            ? "warning"
            : "info";
  const label =
    status === "running"
      ? `Running ${progress}%`
      : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}

function GenerationStatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "exported"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "running" || status === "queued"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function ProjectBriefPanel({ brief }: { brief: ProjectBrief }) {
  const drawings = brief.drawings ?? [];
  const scopes = brief.scopes_present ?? [];
  return (
    <section className="panel mt-6 p-5">
      <h2 className="text-base font-extrabold text-[var(--foreground)]">
        Project understanding (lead coordinator)
      </h2>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {brief.project_name ? (
          <p>
            <span className="font-bold">Project:</span> {brief.project_name}
          </p>
        ) : null}
        {brief.client_name ? (
          <p>
            <span className="font-bold">Client:</span> {brief.client_name}
          </p>
        ) : null}
        {brief.project_type ? (
          <p>
            <span className="font-bold">Type:</span> {brief.project_type}
          </p>
        ) : null}
      </div>

      {scopes.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase text-[var(--muted)]">
            Mapped scopes
          </span>
          {scopes.map((s) => (
            <Badge key={s} tone="info">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      {drawings.length > 0 ? (
        <div className="mt-4 table-shell overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Drawing</th>
                <th>Number</th>
                <th>Scope</th>
                <th>Covers</th>
              </tr>
            </thead>
            <tbody>
              {drawings.slice(0, 30).map((d, i) => (
                <tr key={i}>
                  <td className="font-semibold">{d.name ?? "—"}</td>
                  <td className="font-mono text-xs">{d.number ?? "—"}</td>
                  <td>{d.scope ?? d.discipline ?? "—"}</td>
                  <td className="max-w-[320px] text-xs leading-5">{d.covers ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ReadinessCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
