import { getSql } from "@/lib/db/client";
import { resolveProjectScopes } from "@/lib/agents/catalog";
import type { AppKnowledgeRow, AppKnowledgeStatus } from "@/lib/db/types";

export type AppKnowledgeInput = {
  agentId: string;
  scope: string;
  measurementStandard: string | null;
  sectionCode?: string | null;
  uploadId?: string | null;
  sourceFileName?: string | null;
  description_patterns?: string | null;
  item_wording_patterns?: string | null;
  trade_section_structure?: string | null;
  heading_structure?: string | null;
  numbering_style?: string | null;
  unit_usage_patterns?: string | null;
  measurement_standard_usage?: string | null;
  scope_description_patterns?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  summary_structure?: string | null;
  collection_structure?: string | null;
  cover_page_style?: string | null;
  excel_formatting_style?: string | null;
  column_structure?: string | null;
  client_company_style?: string | null;
  sample_items?: unknown[];
  detected_units?: string[];
  raw_analysis?: Record<string, unknown>;
  confidence_score?: number;
  createdBy?: string | null;
};

export async function insertAppKnowledge(input: AppKnowledgeInput) {
  const sql = getSql();
  const rows = (await sql`
    insert into app_knowledge_base (
      agent_id, scope, measurement_standard, section_code, upload_id, source_file_name,
      description_patterns, item_wording_patterns, trade_section_structure,
      heading_structure, numbering_style, unit_usage_patterns, measurement_standard_usage,
      scope_description_patterns, inclusions, exclusions, summary_structure,
      collection_structure, cover_page_style, excel_formatting_style, column_structure,
      client_company_style, sample_items, detected_units, raw_analysis,
      confidence_score, created_by
    )
    values (
      ${input.agentId}, ${input.scope}, ${input.measurementStandard},
      ${input.sectionCode ?? null}, ${input.uploadId ?? null}, ${input.sourceFileName ?? null},
      ${input.description_patterns ?? null}, ${input.item_wording_patterns ?? null},
      ${input.trade_section_structure ?? null}, ${input.heading_structure ?? null},
      ${input.numbering_style ?? null}, ${input.unit_usage_patterns ?? null},
      ${input.measurement_standard_usage ?? null}, ${input.scope_description_patterns ?? null},
      ${input.inclusions ?? null}, ${input.exclusions ?? null}, ${input.summary_structure ?? null},
      ${input.collection_structure ?? null}, ${input.cover_page_style ?? null},
      ${input.excel_formatting_style ?? null}, ${input.column_structure ?? null},
      ${input.client_company_style ?? null},
      ${JSON.stringify(input.sample_items ?? [])}::jsonb,
      ${JSON.stringify(input.detected_units ?? [])}::jsonb,
      ${JSON.stringify(input.raw_analysis ?? {})}::jsonb,
      ${input.confidence_score ?? 0.7}, ${input.createdBy ?? null}
    )
    returning *
  `) as AppKnowledgeRow[];
  return rows[0];
}

export async function getAppKnowledge(options?: {
  scope?: string;
  agentId?: string;
  includeDisabled?: boolean;
}): Promise<AppKnowledgeRow[]> {
  const sql = getSql();
  const includeDisabled = options?.includeDisabled ?? false;

  const rows = (await sql`
    select *
    from app_knowledge_base
    where (${options?.scope ?? null}::text is null or scope = ${options?.scope ?? null})
      and (${options?.agentId ?? null}::text is null or agent_id = ${options?.agentId ?? null})
      and (${includeDisabled} or status <> 'disabled')
    order by created_at desc
  `) as AppKnowledgeRow[];
  return rows;
}

export async function getAppKnowledgeById(id: string): Promise<AppKnowledgeRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from app_knowledge_base where id = ${id} limit 1
  `) as AppKnowledgeRow[];
  return rows[0] ?? null;
}

export async function setAppKnowledgeStatus(id: string, status: AppKnowledgeStatus) {
  const sql = getSql();
  await sql`update app_knowledge_base set status = ${status}, updated_at = now() where id = ${id}`;
}

export type AppKnowledgeEditableFields = {
  scope: string;
  agentId: string;
  measurementStandard: string | null;
  sectionCode: string | null;
  description_patterns: string | null;
  item_wording_patterns: string | null;
  trade_section_structure: string | null;
  heading_structure: string | null;
  numbering_style: string | null;
  unit_usage_patterns: string | null;
  measurement_standard_usage: string | null;
  scope_description_patterns: string | null;
  inclusions: string | null;
  exclusions: string | null;
  summary_structure: string | null;
  collection_structure: string | null;
  cover_page_style: string | null;
  excel_formatting_style: string | null;
  column_structure: string | null;
  client_company_style: string | null;
};

export async function updateAppKnowledge(id: string, fields: AppKnowledgeEditableFields) {
  const sql = getSql();
  await sql`
    update app_knowledge_base
    set
      scope = ${fields.scope},
      agent_id = ${fields.agentId},
      measurement_standard = ${fields.measurementStandard},
      section_code = ${fields.sectionCode},
      description_patterns = ${fields.description_patterns},
      item_wording_patterns = ${fields.item_wording_patterns},
      trade_section_structure = ${fields.trade_section_structure},
      heading_structure = ${fields.heading_structure},
      numbering_style = ${fields.numbering_style},
      unit_usage_patterns = ${fields.unit_usage_patterns},
      measurement_standard_usage = ${fields.measurement_standard_usage},
      scope_description_patterns = ${fields.scope_description_patterns},
      inclusions = ${fields.inclusions},
      exclusions = ${fields.exclusions},
      summary_structure = ${fields.summary_structure},
      collection_structure = ${fields.collection_structure},
      cover_page_style = ${fields.cover_page_style},
      excel_formatting_style = ${fields.excel_formatting_style},
      column_structure = ${fields.column_structure},
      client_company_style = ${fields.client_company_style},
      updated_at = now()
    where id = ${id}
  `;
}

export async function deleteAppKnowledge(id: string) {
  const sql = getSql();
  await sql`delete from app_knowledge_base where id = ${id}`;
}

/**
 * Build the merged "learned house style" notes for a generation, drawn from the
 * app-wide knowledge base. Matches the project's disciplines and measurement
 * standard, and always includes standard-agnostic ("General") knowledge.
 */
export async function getAppKnowledgeNotesForProject({
  projectScope,
  measurementStandard
}: {
  projectScope: string;
  measurementStandard: string;
}): Promise<string[]> {
  const sql = getSql();
  const scopeDefs = resolveProjectScopes(projectScope);
  const scopeNames = Array.from(
    new Set([...scopeDefs.map((s) => s.scope), "General"])
  );

  let rows = (await sql`
    select *
    from app_knowledge_base
    where status <> 'disabled'
      and scope = any(${scopeNames})
      and (measurement_standard is null or measurement_standard = ${measurementStandard})
    order by status = 'approved' desc, created_at desc
    limit 40
  `) as AppKnowledgeRow[];

  // Fallback: if nothing scope-matched, use any active knowledge for the standard.
  if (rows.length === 0) {
    rows = (await sql`
      select *
      from app_knowledge_base
      where status <> 'disabled'
        and (measurement_standard is null or measurement_standard = ${measurementStandard})
      order by created_at desc
      limit 20
    `) as AppKnowledgeRow[];
  }

  return buildAppKnowledgeNotes(rows);
}

export function buildAppKnowledgeNotes(rows: AppKnowledgeRow[]): string[] {
  const notes: string[] = [];

  for (const row of rows) {
    const prefix = `(${row.scope}${row.section_code ? ` §${row.section_code}` : ""})`;
    const add = (label: string, value: string | null) => {
      if (value && value.trim().length > 0) {
        notes.push(`${prefix} ${label}: ${value.trim()}`);
      }
    };
    add("Description writing pattern", row.description_patterns);
    add("Item wording pattern", row.item_wording_patterns);
    add("Trade/section structure", row.trade_section_structure);
    add("Heading structure", row.heading_structure);
    add("Numbering style", row.numbering_style);
    add("Unit usage", row.unit_usage_patterns);
    add("Measurement standard usage", row.measurement_standard_usage);
    add("Scope description patterns", row.scope_description_patterns);
    add("Inclusions", row.inclusions);
    add("Exclusions", row.exclusions);
    add("Summary structure", row.summary_structure);
    add("Collection structure", row.collection_structure);
    add("Excel formatting style", row.excel_formatting_style);
    add("Column structure", row.column_structure);
    add("Client/company style", row.client_company_style);

    for (const sample of (row.sample_items ?? []).slice(0, 4)) {
      if (sample.description) {
        const unit = sample.unit ? ` [${sample.unit}]` : "";
        notes.push(`${prefix} Example item: ${sample.description}${unit}`);
      }
    }
  }

  // Keep the prompt bounded.
  return notes.slice(0, 60);
}
