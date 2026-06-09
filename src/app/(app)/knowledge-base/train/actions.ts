"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { requireCurrentAppUser } from "@/lib/db/users";
import {
  analyzePreviousBoqUpload,
  getPreviousBoqUploadById
} from "@/lib/knowledge/analyze-app-upload";
import type { PreviousBoqUploadRow } from "@/lib/db/types";

/**
 * Register an uploaded previous BOQ (app-wide) and analyse it synchronously.
 * Called by the client right after the blob upload resolves, so analysis runs
 * reliably without depending on the Vercel Blob webhook.
 */
export async function registerUploadAction(input: {
  url: string;
  fileName: string;
  measurementStandard?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireCurrentAppUser();
  const sql = getSql();

  const rows = (await sql`
    insert into previous_boq_uploads (
      uploaded_by, file_name, storage_url, measurement_standard, status
    )
    values (
      ${user.id}, ${input.fileName}, ${input.url},
      ${input.measurementStandard ?? null}, 'uploaded'
    )
    returning *
  `) as PreviousBoqUploadRow[];

  const result = await analyzePreviousBoqUpload(rows[0]);

  revalidatePath("/knowledge-base/train");
  revalidatePath("/knowledge-base");
  return result.success ? { ok: true } : { ok: false, error: result.error };
}

export async function reanalyzeUploadAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = z.string().uuid().parse(formData.get("uploadId"));
  const upload = await getPreviousBoqUploadById(id);
  if (!upload) throw new Error("Upload not found.");

  // Analyse synchronously so it runs reliably.
  await analyzePreviousBoqUpload(upload);

  revalidatePath("/knowledge-base/train");
  revalidatePath("/knowledge-base");
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
