"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import {
  getGeneration,
  permanentlyDeleteGeneration,
  restoreGeneration,
  softDeleteGeneration
} from "@/lib/db/generations";
import {
  assertProjectAccess,
  permanentlyDeleteProject,
  restoreProject,
  softDeleteProject
} from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

async function deleteBlobs(urls: string[]) {
  if (urls.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  await Promise.all(
    urls.map((url) =>
      del(url).catch((error) => console.error("Blob delete failed:", url, error))
    )
  );
}

async function assertGenerationAccess(generationId: string, userId: string) {
  const generation = await getGeneration(generationId);
  if (!generation) {
    throw new Error("Generation not found.");
  }
  await assertProjectAccess(generation.project_id, userId);
  return generation;
}

// ── Generations ─────────────────────────────────────────────────────────────
export async function moveGenerationToRecycleBinAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const generationId = z.string().uuid().parse(formData.get("generationId"));
  const generation = await assertGenerationAccess(generationId, user.id);

  await softDeleteGeneration(generationId);
  await addActivityLog({
    projectId: generation.project_id,
    userId: user.id,
    action: "generation.recycled",
    details: { generationId }
  });

  revalidatePath(`/projects/${generation.project_id}/generate`);
  revalidatePath("/recycle-bin");
}

export async function restoreGenerationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const generationId = z.string().uuid().parse(formData.get("generationId"));
  const generation = await assertGenerationAccess(generationId, user.id);

  await restoreGeneration(generationId);
  revalidatePath(`/projects/${generation.project_id}/generate`);
  revalidatePath("/recycle-bin");
}

export async function permanentlyDeleteGenerationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const generationId = z.string().uuid().parse(formData.get("generationId"));
  const generation = await assertGenerationAccess(generationId, user.id);

  const { exportUrls } = await permanentlyDeleteGeneration(generationId);
  await deleteBlobs(exportUrls);
  await addActivityLog({
    projectId: generation.project_id,
    userId: user.id,
    action: "generation.deleted",
    details: { generationId }
  });

  revalidatePath(`/projects/${generation.project_id}/generate`);
  revalidatePath("/recycle-bin");
}

// ── Projects ────────────────────────────────────────────────────────────────
export async function moveProjectToRecycleBinAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  await assertProjectAccess(projectId, user.id);

  await softDeleteProject(projectId);
  await addActivityLog({
    projectId,
    userId: user.id,
    action: "project.recycled",
    details: {}
  });

  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function restoreProjectAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  await assertProjectAccess(projectId, user.id);

  await restoreProject(projectId);
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function permanentlyDeleteProjectAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  await assertProjectAccess(projectId, user.id);

  const { storageUrls } = await permanentlyDeleteProject(projectId);
  await deleteBlobs(storageUrls);

  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}
