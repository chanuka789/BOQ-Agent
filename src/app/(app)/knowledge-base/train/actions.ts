"use server";

import { del } from "@vercel/blob";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { requireCurrentAppUser } from "@/lib/db/users";
import {
  analyzePreviousBoqUpload,
  getPreviousBoqUploadById
} from "@/lib/knowledge/analyze-app-upload";

export async function reanalyzeUploadAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = z.string().uuid().parse(formData.get("uploadId"));
  const upload = await getPreviousBoqUploadById(id);
  if (!upload) throw new Error("Upload not found.");

  const sql = getSql();
  await sql`update previous_boq_uploads set status = 'analyzing', updated_at = now() where id = ${id}`;
  after(() => analyzePreviousBoqUpload(upload));

  revalidatePath("/knowledge-base/train");
}

export async function deleteUploadAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = z.string().uuid().parse(formData.get("uploadId"));
  const upload = await getPreviousBoqUploadById(id);
  if (!upload) return;

  const sql = getSql();
  // Cascades to app_knowledge_base rows linked by upload_id.
  await sql`delete from previous_boq_uploads where id = ${id}`;
  if (upload.storage_url && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(upload.storage_url).catch(() => {});
  }

  revalidatePath("/knowledge-base/train");
  revalidatePath("/knowledge-base");
}
