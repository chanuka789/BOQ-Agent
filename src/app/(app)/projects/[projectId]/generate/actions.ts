"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { createGenerationJob } from "@/lib/db/boq";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

export async function queueGenerationAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));

  await assertProjectAccess(projectId, user.id);
  const job = await createGenerationJob(projectId);
  await addActivityLog({
    projectId,
    userId: user.id,
    action: "generation.queued",
    details: { jobId: job.id }
  });

  revalidatePath(`/projects/${projectId}/generate`);
}
