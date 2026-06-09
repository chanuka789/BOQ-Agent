import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LockedCell } from "@/components/locked-cell";
import { PageHeader } from "@/components/page-header";
import { ReviewBanner } from "@/components/review-banner";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getBoqAssumptions, getBoqItems, getBoqQueries } from "@/lib/db/boq";
import { getGenerations, getGenerationExports, resolveGeneration } from "@/lib/db/generations";
import { getAppKnowledge } from "@/lib/db/app-knowledge";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getProjectTemplates } from "@/lib/db/templates";
import { formatDate } from "@/lib/format";

export default async function ExportPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ generation?: string }>;
}) {
  const { projectId } = await params;
  const { generation: generationParam } = await searchParams;

  try {
    const { project } = await getProjectForCurrentUser(projectId);
    const { generation, generationId } = await resolveGeneration(projectId, generationParam);
    const [templates, generations, items, queries, assumptions, knowledge, pastExports] =
      await Promise.all([
        getProjectTemplates(projectId),
        getGenerations(projectId),
        getBoqItems(projectId, generationId),
        getBoqQueries(projectId, generationId),
        getBoqAssumptions(projectId, generationId),
        getAppKnowledge({ includeDisabled: false }),
        generationId ? getGenerationExports(generationId) : Promise.resolve([])
      ]);

    const canExport = items.length > 0;
    const exportHref = generationId
      ? `/api/export/${projectId}?generation=${generationId}`
      : `/api/export/${projectId}`;

    return (
      <>
        <PageHeader
          title="Export"
          description={`Editable Excel BOQ draft for ${project.name}${generation ? ` · ${generation.label}` : ""}.`}
          action={
            canExport ? (
              <a className="btn btn-primary" href={exportHref} download>
                <Download size={16} aria-hidden="true" />
                Download .xlsx
              </a>
            ) : (
              <button className="btn btn-primary" type="button" disabled>
                <Download size={16} aria-hidden="true" />
                Download .xlsx
              </button>
            )
          }
        />
        <ReviewBanner />

        {generations.length > 1 ? (
          <section className="panel mb-5 p-4">
            <p className="mb-2 text-xs font-extrabold uppercase text-[var(--muted)]">
              Choose a generation to export
            </p>
            <div className="flex flex-wrap gap-2">
              {generations.map((g) => (
                <Link
                  key={g.id}
                  href={`/projects/${projectId}/export?generation=${g.id}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    g.id === generationId
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--foreground)]"
                  }`}
                >
                  {g.label} · {g.item_count} items
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Generate BOQ items first"
            description="The Excel export builds from the generated BOQ. Generate a BOQ draft, then return here to download a formatted .xlsx with blank quantity, rate and amount columns."
            actionHref={`/projects/${projectId}/generate`}
            actionLabel="Generate BOQ"
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="panel p-5">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Export preview
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                The download builds a formatted .xlsx workbook: a <strong>BOQ</strong>{" "}
                sheet grouped by trade section with headings, descriptions and
                units; blank quantity, rate and amount columns; plus{" "}
                <strong>Summary</strong>, <strong>Assumptions</strong>,{" "}
                <strong>Queries (RFI)</strong> and an <strong>AI Review Notice</strong>{" "}
                sheet.
                {knowledge.length > 0
                  ? " The structure and summary layout follow the style learned from your previous BOQs."
                  : templates.length > 0
                    ? " Upload and analyse a previous BOQ to make the export match your house style even more closely."
                    : ""}
              </p>

              <div className="mt-5 table-shell overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Unit</th>
                      <th>Quantity</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 8).map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="font-mono font-bold">{item.unit}</td>
                        <td>
                          <LockedCell />
                        </td>
                        <td>
                          <LockedCell />
                        </td>
                        <td>
                          <LockedCell />
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No BOQ items generated yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-4">
              <Metric label="BOQ items" value={items.length} />
              <Metric label="Learned patterns" value={knowledge.length} tone="info" />
              <Metric label="Templates" value={templates.length} tone="info" />
              <Metric label="Queries" value={queries.length} tone="warning" />
              <Metric label="Assumptions" value={assumptions.length} />

              {pastExports.length > 0 ? (
                <div className="card p-4">
                  <p className="text-sm font-extrabold text-[var(--foreground)]">
                    Export history
                  </p>
                  <ul className="mt-3 space-y-2">
                    {pastExports.map((exportRow) => (
                      <li key={exportRow.id} className="flex items-center justify-between gap-2 text-xs">
                        <a
                          className="truncate font-semibold text-[var(--primary)]"
                          href={exportHref}
                          download
                          title={exportRow.file_name}
                        >
                          {exportRow.file_name}
                        </a>
                        <span className="shrink-0 text-[var(--muted)]">
                          {formatDate(exportRow.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Export" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "info" | "warning";
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-[var(--foreground)]">{label}</p>
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}
