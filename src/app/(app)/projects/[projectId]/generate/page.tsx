import { Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { JobStatusBadge, Badge } from "@/components/status-badge";
import { getAgentJobs } from "@/lib/db/boq";
import { getProjectFiles } from "@/lib/db/files";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { formatDate } from "@/lib/format";
import { queueGenerationAction } from "./actions";

export default async function GeneratePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, files, templates, rules, jobs] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getProjectFiles(projectId),
      getProjectTemplates(projectId),
      getRules({ projectId }),
      getAgentJobs(projectId)
    ]);
    const sourceFiles = files.filter((file) => file.file_type === "source_document");

    return (
      <>
        <PageHeader
          title="Generate BOQ"
          description="Queue an AI drafting job after templates, source documents, and rules are ready."
          action={
            <form action={queueGenerationAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <button className="btn btn-primary" type="submit">
                <Play size={16} aria-hidden="true" />
                Generate BOQ draft
              </button>
            </form>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <ReadinessCard label="Source documents" value={sourceFiles.length} />
          <ReadinessCard label="BOQ templates" value={templates.length} />
          <ReadinessCard label="Unit rules" value={rules.length} />
          <ReadinessCard label="Queued jobs" value={jobs.length} />
        </div>

        <section className="panel mt-6 p-5">
          <h2 className="text-base font-extrabold text-[var(--foreground)]">
            Generation guardrails
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Descriptions and units only",
              "Quantity, rate, and amount stay blank",
              `Use ${project.measurement_standard} and template units`,
              "Raise queries instead of guessing",
              "Store source reference on every item",
              "Low confidence starts as needs review"
            ].map((item) => (
              <div key={item} className="rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-2 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Jobs
            </h2>
            <Badge>{jobs.length} jobs</Badge>
          </div>
          {jobs.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No generation jobs yet"
              description="Queue a generation job when source documents, templates, and rules are ready."
            />
          ) : (
            <div className="table-shell overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Current step</th>
                    <th>Created</th>
                    <th>Next</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="font-mono text-xs">{job.id.slice(0, 8)}</td>
                      <td>
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td>{job.progress}%</td>
                      <td>
                        <span>{job.current_step ?? "Waiting"}</span>
                        {job.status === "failed" && job.message && (
                          <p className="mt-1 text-xs text-[var(--danger)] break-words max-w-[280px]">
                            {job.message}
                          </p>
                        )}
                      </td>
                      <td>{formatDate(job.created_at)}</td>
                      <td>
                        <Link className="font-bold text-[var(--primary)]" href={`/projects/${projectId}/boq-review`}>
                          Review BOQ
                        </Link>
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
        <PageHeader
          title="Generate BOQ"
          description="Queue an AI drafting job."
        />
        <SetupRequired error={error} />
      </>
    );
  }
}

function ReadinessCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
