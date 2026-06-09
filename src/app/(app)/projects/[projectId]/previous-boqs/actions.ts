"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { analyzePreviousBoqFile } from "@/lib/knowledge/analyze-previous-boq";
import type { ProjectRow } from "@/lib/db/types";

export async function analyzePreviousBoqAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  const fileId = z.string().uuid().parse(formData.get("fileId"));

  await assertProjectAccess(projectId, user.id);

  const sql = getSql();
  const projectRows = (await sql`
    select id, measurement_standard from projects where id = ${projectId} limit 1
  `) as Pick<ProjectRow, "id" | "measurement_standard">[];
  const project = projectRows[0];
  if (!project) {
    throw new Error("Project not found.");
  }

  const files = await getProjectFiles(projectId);
  const file = files.find((f) => f.id === fileId && f.file_type === "previous_boq");
  if (!file) {
    throw new Error("Previous BOQ file not found.");
  }

  // Mark as analyzing immediately, then run the LLM analysis after responding.
  await sql`
    insert into boq_knowledge (project_id, file_id, source_file_name, status)
    values (${projectId}, ${fileId}, ${file.file_name}, 'analyzing')
    on conflict do nothing
  `;

  after(() => analyzePreviousBoqFile(project, file));

  revalidatePath(`/projects/${projectId}/previous-boqs`);
}
