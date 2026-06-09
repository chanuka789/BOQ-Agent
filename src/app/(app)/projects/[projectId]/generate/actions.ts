"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { createGenerationJob } from "@/lib/db/boq";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { runBoqGeneration } from "@/lib/generation/run-boq-generation";

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

  // Run the generation after the response is sent so the page updates immediately
  after(() => runBoqGeneration(projectId, job.id));

  revalidatePath(`/projects/${projectId}/generate`);
}
