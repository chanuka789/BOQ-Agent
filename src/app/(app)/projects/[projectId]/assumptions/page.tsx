import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { getBoqAssumptions } from "@/lib/db/boq";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { formatDate } from "@/lib/format";

export default async function AssumptionsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, assumptions] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getBoqAssumptions(projectId)
    ]);

    return (
      <>
        <PageHeader
          title="Assumption register"
          description={`Assumptions made while drafting ${project.name}. These remain visible until a QS confirms or edits the BOQ item.`}
        />

        {assumptions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assumptions recorded"
            description="Any AI drafting assumptions will appear here with source references."
          />
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Assumption</th>
                  <th>Source</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.map((assumption) => (
                  <tr key={assumption.id}>
                    <td className="font-semibold">{assumption.assumption}</td>
                    <td className="text-[var(--primary)]">
                      {assumption.source_reference ?? "No source"}
                    </td>
                    <td>{formatDate(assumption.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Assumption register" />
        <SetupRequired error={error} />
      </>
    );
  }
}
