import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { QueryStatusBadge } from "@/components/status-badge";
import { getBoqQueries } from "@/lib/db/boq";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { formatDate } from "@/lib/format";

export default async function QueriesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, queries] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getBoqQueries(projectId)
    ]);

    return (
      <>
        <PageHeader
          title="Query register"
          description={`Clarifications raised for ${project.name}. Missing or conflicting information becomes a query instead of a guess.`}
        />

        {queries.length === 0 ? (
          <EmptyState
            icon={FileQuestion}
            title="No queries raised"
            description="When generation finds missing or conflicting source information, the issue will appear here for QS review."
          />
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Clarification needed</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((query) => (
                  <tr key={query.id}>
                    <td className="font-semibold">{query.issue}</td>
                    <td>{query.clarification_needed}</td>
                    <td className="text-[var(--primary)]">
                      {query.source_reference ?? "No source"}
                    </td>
                    <td>
                      <QueryStatusBadge status={query.status} />
                    </td>
                    <td>{formatDate(query.created_at)}</td>
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
        <PageHeader title="Query register" />
        <SetupRequired error={error} />
      </>
    );
  }
}
