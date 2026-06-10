import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { selectSectionAgents, type FileSignal, type SectionAgent } from "@/lib/agents/sections";
import { SCOPES } from "@/lib/agents/catalog";
import { isQualityMode, type QualityMode } from "@/lib/ai/model-config";
import { primaryModel } from "@/lib/ai/model-router";
import { runAiJson } from "@/lib/ai/run";
import { insertBoqQueriesBulk, updateAgentJob } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { getKnownSourceTokens } from "@/lib/db/documents";
import { processProjectDocuments } from "@/lib/documents/process";
import {
  briefNoteForScope,
  buildProjectBrief,
  findCoverageGaps
} from "@/lib/generation/project-brief";
import type { ProjectBrief } from "@/lib/db/types";
import {
  addThought,
  getGeneration,
  updateGenerationStatus,
  upsertAgentLog
} from "@/lib/db/generations";
import { extractFileText } from "@/lib/documents/extractor";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

/**
 * Main coordinator decision: ask a cheap model which discipline scopes are
 * actually present in the uploaded documents. Returns extra scope names to merge
 * with keyword detection. Best-effort — falls back to keyword detection on error.
 */
async function detectScopesWithAI(
  signals: FileSignal[],
  mode: QualityMode,
  context: { projectId: string; generationId?: string | null }
): Promise<string[]> {
  const summary = signals
    .map((s, i) => `Doc ${i + 1}: ${s.fileName}${s.documentType ? ` (${s.documentType})` : ""}\n${(s.textSample ?? "").slice(0, 1500)}`)
    .join("\n\n")
    .slice(0, 18000);
  if (summary.trim().length === 0) return [];

  const scopeNames = SCOPES.map((s) => s.scope);
  try {
    const result = await runAiJson<{ scopes: string[] }>({
      task: "scope_detection",
      mode,
      maxTokens: 500,
      context: { projectId: context.projectId, generationId: context.generationId, agentId: "coordinator" },
      messages: [
        {
          role: "system",
          content: `You are the lead Quantity Surveyor coordinating a BOQ. From the uploaded project documents, decide which discipline scopes are actually present and require a BOQ agent. Only choose from: ${scopeNames.join(", ")}. Do not include a scope unless its work clearly appears. Return strict JSON: {"scopes": ["..."]}.`
        },
        { role: "user", content: `Documents:\n${summary}\n\nReturn the present scopes as strict JSON.` }
      ]
    });
    return (result.data.scopes ?? []).filter((s) => scopeNames.includes(s));
  } catch (error) {
    console.error("AI scope detection failed, using keyword detection:", error);
    return [];
  }
}

type WorkerResult = {
  success: boolean;
  trade: string;
  model?: string;
  reasoning?: string;
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
  // Live reasoning feed helper (no-op when there is no generation row).
  const think = (
    agentId: string,
    agentLabel: string,
    phase: string,
    thought: string,
    kind: "thought" | "reasoning" | "status" = "thought"
  ) =>
    generationId
      ? addThought({ generationId, projectId, agentId, agentLabel, phase, kind, thought })
      : Promise.resolve();

  try {
    await think(
      "coordinator",
      "Lead Coordinator",
      "coordinator",
      "Starting the BOQ. Reading the uploaded documents and understanding the project before assigning agents…"
    );
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Loading project data",
      progress: 5
    });
    if (generationId) {
      await updateGenerationStatus(generationId, "running");
    }

    const [project, allFiles, generationRow] = await Promise.all([
      getProjectById(projectId),
      getProjectFiles(projectId),
      generationId ? getGeneration(generationId) : Promise.resolve(null)
    ]);
    if (!project) throw new Error("Project not found.");

    const mode: QualityMode = isQualityMode(generationRow?.quality_mode)
      ? generationRow.quality_mode
      : "balanced";
    const sectionModelLabel = primaryModel("section_agent_processing", mode);

    // Only true source documents feed generation and scope detection.
    const sourceFiles = allFiles.filter((file) => file.file_type === "source_document");

    // LAYER 1 + 2 — Document extraction & intelligence. Build the structured,
    // classified, searchable chunk/schedule layer for any not-yet-indexed file
    // so the section agents retrieve from it (idempotent; skips indexed files).
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Processing documents — extraction & intelligence layer",
      progress: 10
    });
    try {
      await processProjectDocuments(project, sourceFiles);
    } catch (processError) {
      console.error("Document processing failed (agents will fall back to raw text):", processError);
    }

    // LEAD COORDINATOR REASONING — understand the project and map drawings/scopes
    // before any agent runs (project name, client, drawing register + scopes).
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Lead coordinator — understanding project & mapping drawings/scopes",
      progress: 15
    });
    let brief: ProjectBrief | null = null;
    try {
      brief = await buildProjectBrief({ project, generationId: generationId ?? null, mode });
    } catch (briefError) {
      console.error("Project understanding pass failed (continuing):", briefError);
    }

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Main coordinator — assigning section agents to mapped scopes",
      progress: 20
    });

    const sql = getSql();
    const standard = project.measurement_standard;

    // ── Build the agent roster ────────────────────────────────────────────────
    let runAgents: SectionAgent[] = [];
    let skippedAgents: Array<{ agent: SectionAgent; reason: string }> = [];

    if (standard === "POMI" || standard === "NRM2" || standard === "NRM1") {
      const signals = await buildFileSignals(sourceFiles);
      // The main coordinator uses an AI pass to decide present scopes, merged
      // with keyword detection (injected as an extra signal).
      const aiScopes = await detectScopesWithAI(signals, mode, { projectId, generationId });
      // Prefer the lead-coordinator brief's mapped scopes, merged with detection.
      const mappedScopes = [...(brief?.scopes_present ?? []), ...aiScopes].join(" ");
      const enrichedSignals =
        mappedScopes.trim().length > 0
          ? [...signals, { fileName: "coordinator-detection", textSample: mappedScopes }]
          : signals;
      const selection = selectSectionAgents({
        standard,
        projectScope: project.scope,
        signals: enrichedSignals
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

    await think(
      "coordinator",
      "Lead Coordinator",
      "coordinator",
      `Assigning ${runAgents.length} section agent(s) to run in parallel` +
        (skippedAgents.length > 0
          ? `, and skipping ${skippedAgents.length} scope(s) with no relevant documents.`
          : ".")
    );

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
            statusText: `Reading documents for ${agent.title} (${sectionModelLabel}).`,
            modelName: sectionModelLabel
          })
        )
      );
      // Pipeline agents that run after the section agents.
      await upsertAgentLog({
        generationId,
        projectId,
        agentId: "qa-agent",
        agentLabel: "BOQ QA Agent",
        status: "waiting",
        progress: 0,
        statusText: "Waiting — will start after section agents complete."
      });
      await upsertAgentLog({
        generationId,
        projectId,
        agentId: "export-agent",
        agentLabel: "Excel Export Agent",
        status: "waiting",
        progress: 0,
        statusText: "Waiting — runs when you download the Excel file."
      });
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
              qualityMode: mode,
              fileIds: sourceFileIds,
              trade: agent.title,
              scope: agent.scope,
              briefNote: briefNoteForScope(brief, agent.scope),
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
              modelName: data.model ?? sectionModelLabel,
              statusText:
                data.itemsCount > 0
                  ? `Generated ${data.itemsCount} ${agent.title} item(s) with ${data.model ?? sectionModelLabel}.`
                  : `No ${agent.title} items found in the uploaded documents.`,
              itemsCount: data.itemsCount,
              queriesCount: data.queriesCount,
              assumptionsCount: data.assumptionsCount
            });
            if (data.reasoning) {
              await think(agent.agentId, agent.label, "section", data.reasoning, "reasoning");
            }
            await think(
              agent.agentId,
              agent.label,
              "section",
              data.itemsCount > 0
                ? `Produced ${data.itemsCount} item(s)${data.queriesCount ? `, raised ${data.queriesCount} quer${data.queriesCount === 1 ? "y" : "ies"}` : ""}.`
                : `Found no ${agent.title} work in the documents for this section.`,
              "status"
            );
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
            await think(
              agent.agentId,
              agent.label,
              "section",
              `Could not complete: ${err instanceof Error ? err.message : String(err)}`,
              "status"
            );
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

    await think(
      "qa-agent",
      "BOQ QA Agent",
      "qa",
      "All section agents are done. I'm now checking for duplicate items, incorrect units, missing source references and coverage gaps against the project plan…"
    );
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "BOQ QA Agent — checking duplicates, units and missing data",
      progress: 85
    });
    const qaModel = primaryModel("final_boq_qa", mode);
    if (generationId) {
      await upsertAgentLog({
        generationId,
        projectId,
        agentId: "qa-agent",
        agentLabel: "BOQ QA Agent",
        status: "running",
        progress: 40,
        modelName: qaModel,
        statusText: `Checking duplicates, units and missing data with ${qaModel}.`
      });
    }

    // QA & dedup — scoped to THIS generation so other generations are untouched.
    const items = (await sql`
      select id, trade, description, unit, item_type, source_reference
      from boq_items
      where project_id = ${projectId}
        and (${generationId ?? null}::uuid is null or generation_id = ${generationId ?? null})
    `) as Array<{
      id: string;
      trade: string;
      description: string;
      unit: string | null;
      item_type: string;
      source_reference: string | null;
    }>;

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

    // Deterministic QA flags raised as queries (not silent fixes).
    const removed = new Set(duplicatesToDelete);
    const measured = items.filter(
      (i) => !removed.has(i.id) && i.item_type === "measured"
    );
    const missingUnit = measured.filter((i) => !i.unit || i.unit.trim() === "");
    const missingRef = measured.filter(
      (i) => !i.source_reference || i.source_reference.trim() === ""
    );

    // BOQ source validation: confirm each cited source resolves to a real indexed
    // document (drawing/file). Standard/spec-code citations are accepted. Only
    // runs when the project has processed document chunks.
    const knownTokens = await getKnownSourceTokens(projectId).catch(() => [] as string[]);
    const standardRefPattern = /(pomi|nrm2|nrm1|division|section|\d{2}\s?\d{2}\s?\d{2}|\d+\.\d+)/i;
    const unverifiedRef =
      knownTokens.length > 0
        ? measured.filter((i) => {
            const ref = (i.source_reference ?? "").trim().toLowerCase();
            if (!ref) return false; // already covered by missingRef
            if (standardRefPattern.test(ref)) return false; // method/spec code is fine
            return !knownTokens.some((t) => ref.includes(t) || t.includes(ref));
          })
        : [];

    const qaQueries = [
      ...unverifiedRef.slice(0, 20).map((i) => ({
        issue: `Unverified source reference "${i.source_reference}" on: "${i.description.slice(0, 100)}"`,
        clarification_needed:
          "QA Agent (source validation): this reference does not match any uploaded drawing or document. Confirm the correct drawing/spec/schedule reference.",
        source_reference: i.source_reference ?? null
      })),
      ...missingUnit.slice(0, 25).map((i) => ({
        issue: `Missing unit on measured item: "${i.description.slice(0, 120)}"`,
        clarification_needed:
          "QA Agent: this measured item has no unit. Confirm the correct unit of measurement against the method, rules and drawings.",
        source_reference: i.source_reference ?? null
      })),
      ...missingRef.slice(0, 25).map((i) => ({
        issue: `Missing source reference: "${i.description.slice(0, 120)}"`,
        clarification_needed:
          "QA Agent: this item has no source reference. Confirm the spec clause, drawing or schedule it derives from.",
        source_reference: null
      }))
    ];

    // Coverage check (no missed items): compare the lead-coordinator coverage
    // plan against what the agents produced and flag gaps.
    const coverageGaps = brief
      ? findCoverageGaps(
          brief,
          items.filter((i) => !removed.has(i.id)).map((i) => ({ trade: i.trade, description: i.description }))
        )
      : [];
    if (coverageGaps.length > 0) qaQueries.push(...coverageGaps);

    // Final LLM QA review (routed to the QA model) — best-effort, bounded.
    let llmQaCount = 0;
    if (measured.length > 0) {
      try {
        const sample = measured
          .slice(0, 60)
          .map((i, n) => `${n + 1}. [${i.trade}] ${i.description} (unit: ${i.unit || "—"})`)
          .join("\n");
        const review = await runAiJson<{
          queries: Array<{ issue: string; clarification_needed: string; source_reference?: string }>;
        }>({
          task: "final_boq_qa",
          mode,
          reasoning: true,
          maxTokens: 2000,
          context: { projectId, generationId, agentId: "qa-agent" },
          messages: [
            {
              role: "system",
              content: `You are the BOQ QA Agent for a ${standard} bill. Review the draft items for: incorrect or implausible units for the described work, likely duplicates/overlaps, conflicting descriptions, and missing material/size/finish/fire-rating detail. Do NOT rewrite items. Raise concise queries/RFIs only. Never comment on quantities, rates or amounts (they are intentionally blank). Return strict JSON {"queries":[{"issue","clarification_needed","source_reference"}]}, at most 20.`
            },
            { role: "user", content: `Draft items:\n${sample}\n\nReturn QA queries as strict JSON.` }
          ]
        });
        const reviewed = (review.data.queries ?? []).slice(0, 20).map((q) => ({
          issue: q.issue,
          clarification_needed: q.clarification_needed,
          source_reference: q.source_reference ?? null
        }));
        llmQaCount = reviewed.length;
        qaQueries.push(...reviewed);
        if (review.reasoning) {
          await think("qa-agent", "BOQ QA Agent", "qa", review.reasoning, "reasoning");
        }
      } catch (qaError) {
        console.error("LLM final QA failed (non-fatal):", qaError);
      }
    }

    if (qaQueries.length > 0) {
      await insertBoqQueriesBulk(projectId, qaQueries, generationId).catch(() => {});
    }

    await think(
      "qa-agent",
      "BOQ QA Agent",
      "qa",
      `QA complete: removed ${duplicatesToDelete.length} duplicate(s); raised ${qaQueries.length} quer${qaQueries.length === 1 ? "y" : "ies"}.`,
      "status"
    );

    if (generationId) {
      await upsertAgentLog({
        generationId,
        projectId,
        agentId: "qa-agent",
        agentLabel: "BOQ QA Agent",
        status: "completed",
        progress: 100,
        modelName: qaModel,
        statusText: `Removed ${duplicatesToDelete.length} duplicate(s); flagged ${missingUnit.length} unit, ${missingRef.length} missing-ref, ${unverifiedRef.length} unverified-source, ${coverageGaps.length} coverage-gap and ${llmQaCount} review issue(s) as queries.`,
        queriesCount: qaQueries.length
      });
    }

    const successful = results.filter((r) => r.success);
    const totalItems = Math.max(
      results.reduce((acc, r) => acc + r.itemsCount, 0) - duplicatesToDelete.length,
      0
    );
    const totalQueries =
      results.reduce((acc, r) => acc + r.queriesCount, 0) + qaQueries.length;
    const totalAssumptions = results.reduce((acc, r) => acc + r.assumptionsCount, 0);
    const totalCost = results.reduce((acc, r) => acc + r.estimatedCostUsd, 0);

    if (successful.length === 0 && runAgents.length > 0) {
      throw new Error("All section agents failed to execute.");
    }

    await think(
      "coordinator",
      "Lead Coordinator",
      "coordinator",
      `Done. The draft BOQ has ${totalItems} item(s), ${totalQueries} quer${totalQueries === 1 ? "y" : "ies"} and ${totalAssumptions} assumption(s) — ready for your review.`,
      "status"
    );

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
