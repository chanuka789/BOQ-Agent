"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { createProjectForUser } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required."),
  clientName: z.string().trim().min(2, "Client name is required."),
  projectType: z.string().trim().min(2, "Project type is required."),
  scope: z.string().trim().min(2, "Scope is required."),
  measurementStandard: z.enum(["POMI", "NRM2", "NRM1", "Custom"])
});

export async function createProjectAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const parsed = projectSchema.parse({
    name: formData.get("name"),
    clientName: formData.get("clientName"),
    projectType: formData.get("projectType"),
    scope: formData.get("scope"),
    measurementStandard: formData.get("measurementStandard")
  });

  const project = await createProjectForUser({
    user,
    ...parsed
  });

  await addActivityLog({
    projectId: project.id,
    userId: user.id,
    action: "project.created",
    details: {
      measurementStandard: parsed.measurementStandard,
      scope: parsed.scope
    }
  });

  redirect(`/projects/${project.id}/upload`);
}
