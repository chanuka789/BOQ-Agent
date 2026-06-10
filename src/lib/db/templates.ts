import { getSql } from "@/lib/db/client";
import { parseBoqTemplate } from "@/lib/templates/parser";
import type {
  BoqTemplateProfileRow,
  BoqTemplateRow,
  ProjectFileRow
} from "@/lib/db/types";

function isExcelTemplate(file: ProjectFileRow): boolean {
  const mime = (file.mime_type ?? "").toLowerCase();
  const name = file.file_name.toLowerCase();
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    /\.(xlsx|xls|xlsm)$/.test(name)
  );
}

function columnLetter(column?: number | null): string | null {
  if (!column) return null;
  let n = column;
  let letters = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    n = Math.floor((n - mod) / 26);
  }
  return letters;
}

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
  let parsed = parsedStructure ?? {};
  let sheetName: string | null = null;
  let headerRow: number | null = null;
  let descriptionColumn: string | null = null;
  let unitColumn: string | null = null;
  let quantityColumn: string | null = null;
  let rateColumn: string | null = null;
  let amountColumn: string | null = null;

  if (isExcelTemplate(file)) {
    try {
      const response = await fetch(file.storage_url);
      if (!response.ok) throw new Error(`Template fetch failed (${response.status})`);
      const result = await parseBoqTemplate(await response.arrayBuffer());
      const workSheet = result.sheets.find((sheet) => sheet.kind === "work");
      parsed = { ...result, status: "parsed" };
      sheetName = workSheet?.name ?? null;
      headerRow = workSheet?.headerRow ?? null;
      descriptionColumn = columnLetter(workSheet?.columns.description);
      unitColumn = columnLetter(workSheet?.columns.unit);
      quantityColumn = columnLetter(workSheet?.columns.quantity);
      rateColumn = columnLetter(workSheet?.columns.rate);
      amountColumn = columnLetter(workSheet?.columns.amount);
    } catch (error) {
      parsed = {
        ...(parsedStructure ?? {}),
        status: "parse_failed",
        error: error instanceof Error ? error.message : "Template parsing failed."
      };
    }
  }

  const rows = (await sql`
    insert into boq_templates (
      project_id,
      file_id,
      profile_id,
      template_name,
      template_kind,
      sheet_name,
      header_row,
      description_column,
      unit_column,
      quantity_column,
      rate_column,
      amount_column,
      parsed_structure
    )
    values (
      ${projectId},
      ${file.id},
      ${profile?.id ?? null},
      ${file.file_name},
      'boq_reference',
      ${sheetName},
      ${headerRow},
      ${descriptionColumn},
      ${unitColumn},
      ${quantityColumn},
      ${rateColumn},
      ${amountColumn},
      ${JSON.stringify(parsed)}::jsonb
    )
    returning *
  `) as BoqTemplateRow[];

  return rows[0];
}
