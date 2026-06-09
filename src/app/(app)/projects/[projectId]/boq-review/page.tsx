import { Table2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReviewBanner } from "@/components/review-banner";
import { SetupRequired } from "@/components/setup-required";
import { getBoqItems, getBoqQueries, getBoqAssumptions } from "@/lib/db/boq";
import { resolveGeneration } from "@/lib/db/generations";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { BoqReviewClient } from "./review-client";

export default async function BoqReviewPage({
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
    const [items, queries, assumptions] = await Promise.all([
      getBoqItems(projectId, generationId),
      getBoqQueries(projectId, generationId),
      getBoqAssumptions(projectId, generationId)
    ]);

    return (
      <>
        <PageHeader
          title="BOQ Review"
          description={`${project.name} · ${project.measurement_standard}${generation ? ` · ${generation.label}` : ""} · descriptions and units only.`}
        />
        <ReviewBanner />

        {items.length === 0 ? (
          queries.length > 0 || assumptions.length > 0 ? (
            <EmptyState
              icon={Table2}
              title="No BOQ items generated"
              description={`The last generation run produced ${queries.length} quer${queries.length === 1 ? "y" : "ies"} and ${assumptions.length} assumption${assumptions.length === 1 ? "" : "s"} but no BOQ items — usually because source documents are missing or ambiguous. Review and resolve the queries, upload source documents, then run generation again.`}
              actionHref={`/projects/${projectId}/queries`}
              actionLabel="Review queries"
            />
          ) : (
            <EmptyState
              icon={Table2}
              title="No BOQ items yet"
              description="Run generation after uploading source documents and templates, then review draft descriptions and units here."
              actionHref={`/projects/${projectId}/generate`}
              actionLabel="Generate BOQ"
            />
          )
        ) : (
          <BoqReviewClient
            projectId={projectId}
            initialItems={items}
            queryCount={queries.length}
            assumptionCount={assumptions.length}
          />
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader
          title="BOQ Review"
          description="Review AI-generated BOQ descriptions and units."
        />
        <SetupRequired error={error} />
      </>
    );
  }
}
