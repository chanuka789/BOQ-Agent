import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { updateAgentJob } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import type { ProjectRow } from "@/lib/db/types";

async function getProjectById(projectId: string): Promise<ProjectRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from projects where id = ${projectId} limit 1
  `) as ProjectRow[];
  return rows[0] ?? null;
}

export async function runBoqGeneration(projectId: string, jobId: string): Promise<void> {
  try {
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Loading project data",
      progress: 5
    });

    const [project, allFiles] = await Promise.all([
      getProjectById(projectId),
      getProjectFiles(projectId)
    ]);

    if (!project) throw new Error("Project not found.");

    // Only true source documents (drawings, specs, schedules) feed generation.
    // Previous BOQs inform the house style via learned knowledge, and templates
    // drive the export — neither should be copied as raw source content.
    const sourceFiles = allFiles.filter(
      (file) => file.file_type === "source_document"
    );

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Identifying target trades",
      progress: 15
    });

    const sql = getSql();
    // Dynamically retrieve trades associated with this project standard and scope from rules
    const uniqueTrades = (await sql`
      select distinct trade
      from boq_rules
      where measurement_standard = ${project.measurement_standard}
        and scope = ${project.scope}
    `) as Array<{ trade: string }>;

    let trades = uniqueTrades.map((r) => r.trade);

    // Fallback if no scope-specific rules found
    if (trades.length === 0) {
      const fallbackTrades = (await sql`
        select distinct trade
        from boq_rules
        where measurement_standard = ${project.measurement_standard}
      `) as Array<{ trade: string }>;
      trades = fallbackTrades.map((r) => r.trade);
    }

    // Default trades list as absolute fallback if no rules seeded
    if (trades.length === 0) {
      trades = ["Woodwork", "Waterproofing", "Doors", "Windows", "Finishes", "Painting", "Partitions"];
    }

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: `Spawning ${trades.length} parallel trade agents`,
      progress: 30
    });

    // Determine baseURL dynamically from headers
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const host = (await headers()).get("host");
      if (host) {
        const protocol = host.includes("localhost") ? "http" : "https";
        baseUrl = `${protocol}://${host}`;
      }
    } catch (e) {
      console.log("Could not read host header, using default app URL:", baseUrl);
    }

    const secret = process.env.INTERNAL_WORKER_SECRET || "boq-agent-secret-123";

    // Call worker route for each trade concurrently
    const workerPromises = trades.map(async (trade) => {
      const url = `${baseUrl}/api/generate/worker`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-worker-secret": secret
          },
          body: JSON.stringify({
            projectId,
            trade,
            scope: project.scope,
            fileIds: sourceFiles.map((f) => f.id),
            jobId
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Worker for trade "${trade}" failed: ${errText}`);
        }

        return (await res.json()) as {
          success: boolean;
          trade: string;
          itemsCount: number;
          queriesCount: number;
          assumptionsCount: number;
          estimatedCostUsd: number;
        };
      } catch (err) {
        console.error(`Error in trade worker "${trade}":`, err);
        return {
          success: false,
          trade,
          itemsCount: 0,
          queriesCount: 0,
          assumptionsCount: 0,
          estimatedCostUsd: 0,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    });

    const results = await Promise.all(workerPromises);

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Running QA & deduplication checks",
      progress: 85
    });

    // QA and Merging step: remove any duplicate items across trades
    const items = (await sql`
      select id, trade, description
      from boq_items
      where project_id = ${projectId}
    `) as Array<{ id: string; trade: string; description: string }>;

    const seen = new Set<string>();
    const duplicatesToDelete: string[] = [];

    for (const item of items) {
      const key = `${item.trade.toLowerCase()}|${item.description.toLowerCase().trim()}`;
      if (seen.has(key)) {
        duplicatesToDelete.push(item.id);
      } else {
        seen.add(key);
      }
    }

    if (duplicatesToDelete.length > 0) {
      await sql`
        delete from boq_items
        where id = any(${duplicatesToDelete})
      `;
      console.log(`Deduplicated ${duplicatesToDelete.length} items.`);
    }

    // Calculate overall stats
    const successfulTrades = results.filter((r) => r.success);
    const totalItems = results.reduce((acc, curr) => acc + curr.itemsCount, 0) - duplicatesToDelete.length;
    const totalQueries = results.reduce((acc, curr) => acc + curr.queriesCount, 0);
    const totalAssumptions = results.reduce((acc, curr) => acc + curr.assumptionsCount, 0);
    const totalCost = results.reduce((acc, curr) => acc + curr.estimatedCostUsd, 0);

    if (successfulTrades.length === 0 && trades.length > 0) {
      throw new Error("All parallel trade agents failed to execute.");
    }

    await updateAgentJob(jobId, {
      status: "completed",
      currentStep: `Generated ${totalItems} items · ${totalQueries} queries · ${totalAssumptions} assumptions`,
      progress: 100,
      message: `Completed successfully. Spawned ${successfulTrades.length}/${trades.length} trade agents.`,
      estimatedCostUsd: totalCost
    });

    // Transition project status to ready_for_review
    await sql`
      update projects
      set status = 'ready_for_review', updated_at = now()
      where id = ${projectId}
    `;

    revalidatePath(`/projects/${projectId}/generate`);
    revalidatePath(`/projects/${projectId}/boq-review`);
    revalidatePath(`/projects/${projectId}/queries`);
    revalidatePath(`/projects/${projectId}/assumptions`);
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("BOQ generation coordinator error:", error);
    const message = error instanceof Error ? error.message : "Unknown error during coordination.";
    await updateAgentJob(jobId, {
      status: "failed",
      currentStep: "Generation failed",
      progress: 0,
      message
    }).catch(() => {});
  }
}
