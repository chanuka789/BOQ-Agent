import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { selectSectionAgents, type FileSignal, type SectionAgent } from "@/lib/agents/sections";
import { updateAgentJob } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { updateGenerationStatus, upsertAgentLog } from "@/lib/db/generations";
import { extractFileText } from "@/lib/documents/extractor";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

type WorkerResult = {
  success: boolean;
  trade: string;
  itemsCount: number;
  queriesCount: number;
  assumptionsCount: number;
  estimatedCostUsd: number;
  error?: string;
};

async function getProjectById(projectId: string): Promise<ProjectRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from projects where id = ${projectId} limit 1
  `) as ProjectRow[];
  return rows[0] ?? null;
}

/** Run async tasks with a bounded concurrency so we don't overwhelm the worker
 *  route or hit model rate limits when many section agents run in parallel. */
async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function buildFileSignals(files: ProjectFileRow[]): Promise<FileSignal[]> {
  return Promise.all(
    files.map(async (file) => {
      let textSample = "";
      try {
        const text = await extractFileText(file.storage_url, file.mime_type, file.file_name);
        textSample = text.slice(0, 8000);
      } catch {
        /* detection falls back to file name / classification */
      }
      return {
        fileName: file.file_name,
        documentType: file.document_type,
        scope: file.scope,
        textSample
      } satisfies FileSignal;
    })
  );
}

/** Build the agent roster for Custom projects from the seeded trades. */
function buildCustomAgents(trades: string[], projectScope: string): SectionAgent[] {
  return trades.map((trade) => ({
    agentId: `custom-${trade}`,
    standard: "POMI", // placeholder; Custom uses rules + learned style, not a standard
    code: "",
    title: trade,
    label: `${trade} Agent`,
    scope: projectScope,
    units: []
  }));
}

export async function runBoqGeneration(
  projectId: string,
  jobId: string,
  generationId?: string | null
): Promise<void> {
  try {
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Loading project data",
      progress: 5
    });
    if (generationId) {
      await updateGenerationStatus(generationId, "running");
    }

    const [project, allFiles] = await Promise.all([
      getProjectById(projectId),
      getProjectFiles(projectId)
    ]);
    if (!project) throw new Error("Project not found.");

    // Only true source documents feed generation and scope detection.
    const sourceFiles = allFiles.filter((file) => file.file_type === "source_document");

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Detecting available scopes from uploaded documents",
      progress: 15
    });

    const sql = getSql();
    const standard = project.measurement_standard;

    // ── Build the agent roster ────────────────────────────────────────────────
    let runAgents: SectionAgent[] = [];
    let skippedAgents: Array<{ agent: SectionAgent; reason: string }> = [];

    if (standard === "POMI" || standard === "NRM2" || standard === "NRM1") {
      const signals = await buildFileSignals(sourceFiles);
      const selection = selectSectionAgents({
        standard,
        projectScope: project.scope,
        signals
      });
      runAgents = selection.run;
      skippedAgents = selection.skipped;
    } else {
      // Custom / client-specific: derive agents from the seeded trades.
      const tradeRows = (await sql`
        select distinct trade from boq_rules
        where measurement_standard = ${standard}
      `) as Array<{ trade: string }>;
      let trades = tradeRows.map((r) => r.trade);
      if (trades.length === 0) {
        trades = ["Woodwork", "Waterproofing", "Doors", "Windows", "Finishes", "Painting", "Partitions"];
      }
      runAgents = buildCustomAgents(trades, project.scope);
    }

    if (runAgents.length === 0) {
      throw new Error("No applicable agents for this project standard and scope.");
    }

    // Record skipped agents up-front so the UI shows them immediately.
    if (generationId) {
      await Promise.all(
        skippedAgents.map(({ agent, reason }) =>
          upsertAgentLog({
            generationId,
            projectId,
            agentId: agent.agentId,
            agentLabel: agent.label,
            scope: agent.scope,
            sectionCode: agent.code || null,
            status: "skipped",
            progress: 100,
            statusText: reason
          })
        )
      );
      await Promise.all(
        runAgents.map((agent) =>
          upsertAgentLog({
            generationId,
            projectId,
            agentId: agent.agentId,
            agentLabel: agent.label,
            scope: agent.scope,
            sectionCode: agent.code || null,
            status: "running",
            progress: 10,
            statusText: `Reading documents for ${agent.title}.`
          })
        )
      );
    }

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: `Running ${runAgents.length} agents · ${skippedAgents.length} skipped`,
      progress: 30
    });

    // ── Worker base URL & secret ──────────────────────────────────────────────
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const host = (await headers()).get("host");
      if (host) {
        const protocol = host.includes("localhost") ? "http" : "https";
        baseUrl = `${protocol}://${host}`;
      }
    } catch {
      /* use default */
    }
    const secret = process.env.INTERNAL_WORKER_SECRET || "boq-agent-secret-123";
    const concurrency = Number(process.env.GENERATION_CONCURRENCY || 5);
    const sourceFileIds = sourceFiles.map((f) => f.id);

    let completedCount = 0;

    const results = await runPool<SectionAgent, WorkerResult>(
      runAgents,
      concurrency,
      async (agent) => {
        try {
          const res = await fetch(`${baseUrl}/api/generate/worker`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-worker-secret": secret },
            body: JSON.stringify({
              projectId,
              jobId,
              generationId,
              fileIds: sourceFileIds,
              trade: agent.title,
              scope: agent.scope,
              agent
            })
          });
          if (!res.ok) {
            throw new Error(`${agent.label} failed: ${await res.text()}`);
          }
          const data = (await res.json()) as WorkerResult;

          if (generationId) {
            await upsertAgentLog({
              generationId,
              projectId,
              agentId: agent.agentId,
              agentLabel: agent.label,
              scope: agent.scope,
              sectionCode: agent.code || null,
              status: data.itemsCount > 0 ? "completed" : "skipped",
              progress: 100,
              statusText:
                data.itemsCount > 0
                  ? `Generated ${data.itemsCount} ${agent.title} item(s).`
                  : `No ${agent.title} items found in the uploaded documents.`,
              itemsCount: data.itemsCount,
              queriesCount: data.queriesCount,
              assumptionsCount: data.assumptionsCount
            });
          }
          return data;
        } catch (err) {
          console.error(`Error in agent "${agent.label}":`, err);
          if (generationId) {
            await upsertAgentLog({
              generationId,
              projectId,
              agentId: agent.agentId,
              agentLabel: agent.label,
              scope: agent.scope,
              sectionCode: agent.code || null,
              status: "failed",
              progress: 100,
              statusText: `Failed to generate ${agent.title} items.`,
              errorMessage: err instanceof Error ? err.message : String(err)
            }).catch(() => {});
          }
          return {
            success: false,
            trade: agent.title,
            itemsCount: 0,
            queriesCount: 0,
            assumptionsCount: 0,
            estimatedCostUsd: 0,
            error: err instanceof Error ? err.message : String(err)
          };
        } finally {
          completedCount += 1;
          const progress = 30 + Math.round((completedCount / runAgents.length) * 50);
          await updateAgentJob(jobId, {
            status: "running",
            currentStep: `Completed ${completedCount}/${runAgents.length} agents`,
            progress
          }).catch(() => {});
        }
      }
    );

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Running QA & deduplication checks",
      progress: 85
    });

    // QA & dedup — scoped to THIS generation so other generations are untouched.
    const items = (await sql`
      select id, trade, description
      from boq_items
      where project_id = ${projectId}
        and (${generationId ?? null}::uuid is null or generation_id = ${generationId ?? null})
    `) as Array<{ id: string; trade: string; description: string }>;

    const seen = new Set<string>();
    const duplicatesToDelete: string[] = [];
    for (const item of items) {
      const key = `${item.trade.toLowerCase()}|${item.description.toLowerCase().trim()}`;
      if (seen.has(key)) duplicatesToDelete.push(item.id);
      else seen.add(key);
    }
    if (duplicatesToDelete.length > 0) {
      await sql`delete from boq_items where id = any(${duplicatesToDelete})`;
    }

    const successful = results.filter((r) => r.success);
    const totalItems = Math.max(
      results.reduce((acc, r) => acc + r.itemsCount, 0) - duplicatesToDelete.length,
      0
    );
    const totalQueries = results.reduce((acc, r) => acc + r.queriesCount, 0);
    const totalAssumptions = results.reduce((acc, r) => acc + r.assumptionsCount, 0);
    const totalCost = results.reduce((acc, r) => acc + r.estimatedCostUsd, 0);

    if (successful.length === 0 && runAgents.length > 0) {
      throw new Error("All section agents failed to execute.");
    }

    await updateAgentJob(jobId, {
      status: "completed",
      currentStep: `Generated ${totalItems} items · ${totalQueries} queries · ${totalAssumptions} assumptions`,
      progress: 100,
      message: `Completed. ${successful.length}/${runAgents.length} agents produced items · ${skippedAgents.length} scope-skipped.`,
      estimatedCostUsd: totalCost
    });

    if (generationId) {
      await updateGenerationStatus(generationId, "completed", {
        itemCount: totalItems,
        queryCount: totalQueries,
        assumptionCount: totalAssumptions,
        estimatedCostUsd: totalCost
      });
    }

    await sql`
      update projects set status = 'ready_for_review', updated_at = now()
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
    if (generationId) {
      await updateGenerationStatus(generationId, "failed").catch(() => {});
    }
  }
}
