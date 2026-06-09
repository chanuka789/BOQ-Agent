import { Download, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LockedCell } from "@/components/locked-cell";
import { PageHeader } from "@/components/page-header";
import { ReviewBanner } from "@/components/review-banner";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getBoqAssumptions, getBoqItems, getBoqQueries } from "@/lib/db/boq";
import { getAnalyzedKnowledge } from "@/lib/db/knowledge";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getProjectTemplates } from "@/lib/db/templates";

export default async function ExportPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, templates, items, queries, assumptions, knowledge] =
      await Promise.all([
        getProjectForCurrentUser(projectId),
        getProjectTemplates(projectId),
        getBoqItems(projectId),
        getBoqQueries(projectId),
        getBoqAssumptions(projectId),
        getAnalyzedKnowledge(projectId)
      ]);

    const canExport = items.length > 0;

    return (
      <>
        <PageHeader
          title="Export"
          description={`Prepare an editable Excel BOQ draft for ${project.name}.`}
          action={
            canExport ? (
              <a
                className="btn btn-primary"
                href={`/api/export/${projectId}`}
                download
              >
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
              <Metric label="Learned BOQs" value={knowledge.length} tone="info" />
              <Metric label="Templates" value={templates.length} tone="info" />
              <Metric label="Queries" value={queries.length} tone="warning" />
              <Metric label="Assumptions" value={assumptions.length} />
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
