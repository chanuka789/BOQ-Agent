import { getSql } from "@/lib/db/client";
import type {
  BoqTemplateProfileRow,
  BoqTemplateRow,
  ProjectFileRow
} from "@/lib/db/types";

export async function getTemplateProfiles() {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_template_profiles
    where is_active = true
    order by name
  `) as BoqTemplateProfileRow[];

  return rows;
}

export async function getDefaultTemplateProfile() {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_template_profiles
    where is_active = true
    order by
      case when name = 'U-View Main Package BOQ' then 0 else 1 end,
      name
    limit 1
  `) as BoqTemplateProfileRow[];

  return rows[0] ?? null;
}

export async function getProjectTemplates(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select t.*
    from boq_templates t
    where t.project_id = ${projectId}
    order by t.created_at desc
  `) as BoqTemplateRow[];

  return rows;
}

export async function createTemplateRecordForFile({
  projectId,
  file,
  parsedStructure
}: {
  projectId: string;
  file: ProjectFileRow;
  parsedStructure?: Record<string, unknown>;
}) {
  const sql = getSql();
  const profile = await getDefaultTemplateProfile();
  const rows = (await sql`
    insert into boq_templates (
      project_id,
      file_id,
      profile_id,
      template_name,
      template_kind,
      parsed_structure
    )
    values (
      ${projectId},
      ${file.id},
      ${profile?.id ?? null},
      ${file.file_name},
      'boq_reference',
      ${JSON.stringify(parsedStructure ?? {})}::jsonb
    )
    returning *
  `) as BoqTemplateRow[];

  return rows[0];
}
