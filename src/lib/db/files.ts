import { getSql } from "@/lib/db/client";
import type { ProjectFileRow } from "@/lib/db/types";

export async function getProjectFiles(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from project_files
    where project_id = ${projectId}
    order by created_at desc
  `) as ProjectFileRow[];

  return rows;
}

export async function createProjectFile({
  projectId,
  uploadedBy,
  fileName,
  fileType,
  mimeType,
  sizeBytes,
  storageUrl
}: {
  projectId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  mimeType: string | null;
  sizeBytes: number;
  storageUrl: string;
}) {
  const sql = getSql();
  const rows = (await sql`
    insert into project_files (
      project_id,
      uploaded_by,
      file_name,
      file_type,
      mime_type,
      size_bytes,
      storage_url,
      status
    )
    values (
      ${projectId},
      ${uploadedBy},
      ${fileName},
      ${fileType},
      ${mimeType},
      ${sizeBytes},
      ${storageUrl},
      'uploaded'
    )
    returning *
  `) as ProjectFileRow[];

  return rows[0];
}

export async function updateProjectFileClassification({
  fileId,
  documentType,
  scope
}: {
  fileId: string;
  documentType: string;
  scope: string;
}) {
  const sql = getSql();

  await sql`
    update project_files
    set
      document_type = ${documentType},
      scope = ${scope},
      status = 'classified',
      classification_confidence = coalesce(classification_confidence, 0.95),
      updated_at = now()
    where id = ${fileId}
  `;
}
