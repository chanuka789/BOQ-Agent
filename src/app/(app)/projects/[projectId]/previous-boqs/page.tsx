import { Library, Sparkles, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectKnowledge, getPreviousBoqFiles } from "@/lib/db/knowledge";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { formatBytes, formatDate } from "@/lib/format";
import type { BoqKnowledgeRow } from "@/lib/db/types";
import { analyzePreviousBoqAction } from "./actions";

const KNOWLEDGE_ASPECTS: Array<{ key: keyof BoqKnowledgeRow; label: string }> = [
  { key: "description_patterns", label: "Description writing patterns" },
  { key: "item_wording_patterns", label: "Item wording patterns" },
  { key: "trade_section_structure", label: "Trade section structure" },
  { key: "heading_structure", label: "Heading structure" },
  { key: "numbering_style", label: "Item numbering style" },
  { key: "unit_usage_patterns", label: "Unit usage patterns" },
  { key: "measurement_standard_usage", label: "Measurement standard usage" },
  { key: "inclusions", label: "Description inclusions" },
  { key: "exclusions", label: "Description exclusions" },
  { key: "formatting_style", label: "Formatting style" },
  { key: "summary_structure", label: "Summary / page structure" }
];

export default async function PreviousBoqsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, files, knowledge] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getPreviousBoqFiles(projectId),
      getProjectKnowledge(projectId)
    ]);

    // Latest knowledge row per source file.
    const knowledgeByFile = new Map<string, BoqKnowledgeRow>();
    for (const row of knowledge) {
      if (row.file_id && !knowledgeByFile.has(row.file_id)) {
        knowledgeByFile.set(row.file_id, row);
      }
    }

    return (
      <>
        <PageHeader
          title="Previous BOQs"
          description={`Upload past bills so the agent learns your house style for ${project.name}. The learned patterns are applied to every new BOQ draft.`}
        />

        {files.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No previous BOQs uploaded"
            description="Upload a previously prepared Bill of Quantities. The agent will analyse it and store your description style, structure, numbering, units, inclusions/exclusions, and summary layout — then reuse them when generating new drafts."
            actionHref={`/projects/${projectId}/upload`}
            actionLabel="Upload a previous BOQ"
          />
        ) : (
          <div className="space-y-5">
            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--foreground)]">
                    Uploaded previous BOQs
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Each analysed bill contributes its style to BOQ generation.
                  </p>
                </div>
                <a className="btn btn-secondary" href={`/projects/${projectId}/upload`}>
                  <UploadCloud size={16} aria-hidden="true" />
                  Add more
                </a>
              </div>

              <div className="mt-5 space-y-3">
                {files.map((file) => {
                  const row = knowledgeByFile.get(file.id);
                  const status = row?.status ?? "pending";
                  return (
                    <div
                      key={file.id}
                      className="rounded-lg border border-[var(--border)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[var(--foreground)]">
                            {file.file_name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {formatBytes(Number(file.size_bytes))} · uploaded{" "}
                            {formatDate(file.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <KnowledgeStatusBadge status={status} />
                          <form action={analyzePreviousBoqAction}>
                            <input type="hidden" name="projectId" value={projectId} />
                            <input type="hidden" name="fileId" value={file.id} />
                            <button className="btn btn-secondary" type="submit">
                              <Sparkles size={15} aria-hidden="true" />
                              {status === "analyzed" ? "Re-analyse" : "Analyse"}
                            </button>
                          </form>
                        </div>
                      </div>

                      {status === "failed" && row?.error_message ? (
                        <p className="mt-3 rounded-md bg-[var(--danger-soft,#fdeaea)] px-3 py-2 text-xs text-[var(--danger)]">
                          Analysis failed: {row.error_message}
                        </p>
                      ) : null}

                      {status === "analyzed" && row ? (
                        <KnowledgeDetails row={row} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Previous BOQs" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function KnowledgeStatusBadge({ status }: { status: string }) {
  if (status === "analyzed") {
    return <Badge tone="success">Learned</Badge>;
  }
  if (status === "analyzing") {
    return <Badge tone="info">Analysing…</Badge>;
  }
  if (status === "failed") {
    return <Badge tone="danger">Failed</Badge>;
  }
  return <Badge tone="warning">Not analysed</Badge>;
}

function KnowledgeDetails({ row }: { row: BoqKnowledgeRow }) {
  const aspects = KNOWLEDGE_ASPECTS.map((aspect) => ({
    label: aspect.label,
    value: row[aspect.key] as string | null
  })).filter((aspect) => aspect.value && aspect.value.trim().length > 0);

  return (
    <div className="mt-4 space-y-4">
      {row.detected_units && row.detected_units.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase text-[var(--muted)]">
            Units learned
          </span>
          {row.detected_units.map((unit) => (
            <span
              key={unit}
              className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--foreground)]"
            >
              {unit}
            </span>
          ))}
        </div>
      ) : null}

      <dl className="grid gap-3 md:grid-cols-2">
        {aspects.map((aspect) => (
          <div
            key={aspect.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
          >
            <dt className="text-xs font-extrabold uppercase text-[var(--muted)]">
              {aspect.label}
            </dt>
            <dd className="mt-1 text-sm leading-6 text-[var(--foreground)]">
              {aspect.value}
            </dd>
          </div>
        ))}
      </dl>

      {row.sample_items && row.sample_items.length > 0 ? (
        <div>
          <p className="text-xs font-extrabold uppercase text-[var(--muted)]">
            Sample items learned
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
            {row.sample_items.slice(0, 8).map((sample, index) => (
              <li key={index} className="flex items-baseline gap-2">
                {sample.item_no ? (
                  <span className="font-mono text-xs font-bold text-[var(--muted)]">
                    {sample.item_no}
                  </span>
                ) : null}
                <span>{sample.description}</span>
                {sample.unit ? (
                  <span className="font-mono text-xs font-bold text-[var(--primary)]">
                    {sample.unit}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
