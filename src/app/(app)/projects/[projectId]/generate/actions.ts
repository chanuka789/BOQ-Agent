"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { createGenerationJob } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { createGeneration } from "@/lib/db/generations";
import { getProjectTemplates } from "@/lib/db/templates";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { runBoqGeneration } from "@/lib/generation/run-boq-generation";
import type { ProjectRow } from "@/lib/db/types";

async function triggerCoordinator(params: {
  projectId: string;
  jobId: string;
  generationId: string;
}) {
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const host = (await headers()).get("host");
    if (host) baseUrl = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  } catch {
    /* use default */
  }
  const secret = process.env.INTERNAL_WORKER_SECRET || "boq-agent-secret-123";
  try {
    const res = await fetch(`${baseUrl}/api/generate/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-secret": secret },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      throw new Error(`Coordinator route returned ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    // Self-heal: if the dedicated route is unreachable (middleware/deployment
    // protection/network), run the coordinator inline so the generation never
    // sits stuck at "queued".
    console.error("Coordinator route trigger failed, running inline:", error);
    await runBoqGeneration(params.projectId, params.jobId, params.generationId);
  }
}

export async function queueGenerationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  const label = (formData.get("label") as string | null)?.trim();
  const qualityMode = z
    .enum(["economy", "balanced", "premium"])
    .catch("balanced")
    .parse(formData.get("qualityMode"));

  await assertProjectAccess(projectId, user.id);

  const sql = getSql();
  const projectRows = (await sql`
    select * from projects where id = ${projectId} limit 1
  `) as ProjectRow[];
  const project = projectRows[0];
  if (!project) throw new Error("Project not found.");

  const [files, templates] = await Promise.all([
    getProjectFiles(projectId),
    getProjectTemplates(projectId)
  ]);
  const existingCount = (await sql`
    select count(*)::int as c from boq_generations where project_id = ${projectId}
  `) as Array<{ c: number }>;

  const sourceFileIds = files
    .filter((f) => f.file_type === "source_document")
    .map((f) => f.id);
  const generationNo = (existingCount[0]?.c ?? 0) + 1;

  // Each run is a separate, stored generation — old generations are never overwritten.
  const generation = await createGeneration({
    projectId,
    label: label && label.length > 0 ? label : `Generation ${generationNo}`,
    measurementStandard: project.measurement_standard,
    templateId: templates[0]?.id ?? null,
    sourceFileIds,
    qualityMode,
    createdBy: user.id
  });

  const job = await createGenerationJob(projectId, generation.id);
  await addActivityLog({
    projectId,
    userId: user.id,
    action: "generation.queued",
    details: { jobId: job.id, generationId: generation.id }
  });

  // Trigger the coordinator route (long maxDuration) after the response is sent
  // so the page updates immediately and the heavy work runs with enough time.
  after(() =>
    triggerCoordinator({ projectId, jobId: job.id, generationId: generation.id })
  );

  revalidatePath(`/projects/${projectId}/generate`);
}

/**
 * Restart a generation that never left "queued" (e.g. the coordinator trigger
 * was blocked). Creates a fresh job and re-triggers the coordinator.
 */
export async function restartGenerationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  const generationId = z.string().uuid().parse(formData.get("generationId"));

  await assertProjectAccess(projectId, user.id);

  const job = await createGenerationJob(projectId, generationId);
  await addActivityLog({
    projectId,
    userId: user.id,
    action: "generation.restarted",
    details: { jobId: job.id, generationId }
  });

  after(() => triggerCoordinator({ projectId, jobId: job.id, generationId }));

  revalidatePath(`/projects/${projectId}/generate`);
}
