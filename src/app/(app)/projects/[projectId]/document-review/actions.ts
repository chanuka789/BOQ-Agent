"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { updateProjectFileClassification } from "@/lib/db/files";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

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
