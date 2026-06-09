import { Download, Play, Sparkles, Table2, Trash2 } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectFiles } from "@/lib/db/files";
import { getAgentLogs, getGenerations } from "@/lib/db/generations";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { formatDate } from "@/lib/format";
import type { AgentLogStatus, BoqGenerationAgentLogRow } from "@/lib/db/types";
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
    const agentLogs = latest ? await getAgentLogs(latest.id) : [];
    const isRunning =
      latest?.status === "running" || latest?.status === "queued";

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
              <div className="mt-4 space-y-2">
                {agentLogs.map((log) => (
                  <AgentRow key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {isRunning
                  ? "Spawning agents…"
                  : "No agent activity recorded for this generation."}
              </p>
            )}

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
  let percent = status === "completed" || status === "exported" ? 100 : 0;
  if (logs.length > 0 && percent !== 100) {
    percent = Math.round(
      logs.reduce((acc, log) => acc + (log.status === "skipped" ? 100 : log.progress), 0) /
        logs.length
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

function AgentRow({ log }: { log: BoqGenerationAgentLogRow }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--foreground)]">{log.agent_label}</span>
        <AgentStatusBadge status={log.status} progress={log.progress} />
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

function ReadinessCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
