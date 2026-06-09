"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { assertProjectAccess, updateProjectDetails } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import type { MeasurementStandard } from "@/lib/db/types";

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  projectType: z.string().min(1, "Project type is required"),
  scope: z.string().min(1, "Scope is required"),
  measurementStandard: z.enum(["POMI", "NRM2", "NRM1", "Custom"])
});

export async function updateProjectAction(formData: FormData) {
  const user = await requireCurrentAppUser();

  const parseResult = updateProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    clientName: formData.get("clientName"),
    projectType: formData.get("projectType"),
    scope: formData.get("scope"),
    measurementStandard: formData.get("measurementStandard")
  });

  if (!parseResult.success) {
    const message = parseResult.error.errors.map((e) => e.message).join(", ");
    redirect(`/projects/${formData.get("projectId")}/settings?error=${encodeURIComponent(message)}`);
  }

  const parsed = parseResult.data;

  const membership = await assertProjectAccess(parsed.projectId, user.id);
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new Error("You do not have permission to edit this project.");
  }

  await updateProjectDetails({
    projectId: parsed.projectId,
    name: parsed.name,
    clientName: parsed.clientName,
    projectType: parsed.projectType,
    scope: parsed.scope,
    measurementStandard: parsed.measurementStandard as MeasurementStandard
  });

  await addActivityLog({
    projectId: parsed.projectId,
    userId: user.id,
    action: "project.updated",
    details: {
      name: parsed.name,
      clientName: parsed.clientName,
      measurementStandard: parsed.measurementStandard
    }
  });

  revalidatePath(`/projects/${parsed.projectId}/settings`);
  revalidatePath(`/projects/${parsed.projectId}/upload`);
  revalidatePath(`/projects/${parsed.projectId}/rules`);
  revalidatePath(`/projects/${parsed.projectId}/generate`);
  revalidatePath(`/projects/${parsed.projectId}/boq-review`);
  revalidatePath("/dashboard");

  redirect(`/projects/${parsed.projectId}/settings`);
}
