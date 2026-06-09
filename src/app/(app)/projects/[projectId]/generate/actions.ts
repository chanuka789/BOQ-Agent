"use server";

import { after } from "next/server";
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

  // Run the generation after the response is sent so the page updates immediately
  after(() => runBoqGeneration(projectId, job.id, generation.id));

  revalidatePath(`/projects/${projectId}/generate`);
}
