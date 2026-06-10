"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { getSql } from "@/lib/db/client";
import { getProjectFiles, updateProjectFileClassification } from "@/lib/db/files";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { processProjectDocuments } from "@/lib/documents/process";
import type { ProjectRow } from "@/lib/db/types";

export async function processDocumentsAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  await assertProjectAccess(projectId, user.id);

  const sql = getSql();
  const rows = (await sql`
    select id, measurement_standard, scope from projects where id = ${projectId} limit 1
  `) as Array<Pick<ProjectRow, "id" | "measurement_standard" | "scope">>;
  const project = rows[0];
  if (!project) throw new Error("Project not found.");

  const files = await getProjectFiles(projectId);
  // Re-process all source documents (extraction + intelligence layers).
  await processProjectDocuments(project, files, { force: true });

  revalidatePath(`/projects/${projectId}/document-review`);
}

const classificationSchema = z.object({
  projectId: z.string().uuid(),
  fileId: z.string().uuid(),
  documentType: z.string().min(2),
  scope: z.string().min(2)
});

export async function updateClassificationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const parsed = classificationSchema.parse({
    projectId: formData.get("projectId"),
    fileId: formData.get("fileId"),
    documentType: formData.get("documentType"),
    scope: formData.get("scope")
  });

  await assertProjectAccess(parsed.projectId, user.id);
  await updateProjectFileClassification(parsed);
  await addActivityLog({
    projectId: parsed.projectId,
    userId: user.id,
    action: "file.classification_updated",
    details: {
      fileId: parsed.fileId,
      documentType: parsed.documentType,
      scope: parsed.scope
    }
  });

  revalidatePath(`/projects/${parsed.projectId}/document-review`);
}
