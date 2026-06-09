import { getSql } from "@/lib/db/client";
import type { BoqKnowledgeRow, ProjectFileRow } from "@/lib/db/types";

export async function getProjectKnowledge(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from boq_knowledge
    where project_id = ${projectId}
    order by created_at desc
  `) as BoqKnowledgeRow[];

  return rows;
}

export async function getAnalyzedKnowledge(projectId: string) {
  const rows = await getProjectKnowledge(projectId);
  return rows.filter((row) => row.status === "analyzed");
}

export async function getPreviousBoqFiles(projectId: string) {
  const sql = getSql();
  const rows = (await sql`
    select *
    from project_files
    where project_id = ${projectId}
      and file_type = 'previous_boq'
    order by created_at desc
  `) as ProjectFileRow[];

  return rows;
}

export type KnowledgeAnalysis = {
  description_patterns?: string;
  item_wording_patterns?: string;
  trade_section_structure?: string;
  heading_structure?: string;
  numbering_style?: string;
  unit_usage_patterns?: string;
  measurement_standard_usage?: string;
  inclusions?: string;
  exclusions?: string;
  formatting_style?: string;
  summary_structure?: string;
  sample_items?: Array<{
    item_no?: string;
    description?: string;
    unit?: string;
    section?: string;
  }>;
  detected_units?: string[];
};

export async function upsertKnowledgeFromAnalysis({
  projectId,
  fileId,
  sourceFileName,
  measurementStandard,
  analysis
}: {
  projectId: string;
  fileId: string | null;
  sourceFileName: string | null;
  measurementStandard: string | null;
  analysis: KnowledgeAnalysis;
}) {
  const sql = getSql();
  const sampleItems = JSON.stringify(analysis.sample_items ?? []);
  const detectedUnits = JSON.stringify(analysis.detected_units ?? []);
  const rawAnalysis = JSON.stringify(analysis);

  // One knowledge row per source file: replace any previous analysis of it.
  if (fileId) {
    await sql`delete from boq_knowledge where project_id = ${projectId} and file_id = ${fileId}`;
  }

  const rows = (await sql`
    insert into boq_knowledge (
      project_id, file_id, source_file_name, measurement_standard,
      description_patterns, item_wording_patterns, trade_section_structure,
      heading_structure, numbering_style, unit_usage_patterns,
      measurement_standard_usage, inclusions, exclusions, formatting_style,
      summary_structure, sample_items, detected_units, raw_analysis, status
    )
    values (
      ${projectId},
      ${fileId},
      ${sourceFileName},
      ${measurementStandard},
      ${analysis.description_patterns ?? null},
      ${analysis.item_wording_patterns ?? null},
      ${analysis.trade_section_structure ?? null},
      ${analysis.heading_structure ?? null},
      ${analysis.numbering_style ?? null},
      ${analysis.unit_usage_patterns ?? null},
      ${analysis.measurement_standard_usage ?? null},
      ${analysis.inclusions ?? null},
      ${analysis.exclusions ?? null},
      ${analysis.formatting_style ?? null},
      ${analysis.summary_structure ?? null},
      ${sampleItems}::jsonb,
      ${detectedUnits}::jsonb,
      ${rawAnalysis}::jsonb,
      'analyzed'
    )
    returning *
  `) as BoqKnowledgeRow[];

  return rows[0];
}

export async function recordKnowledgeFailure({
  projectId,
  fileId,
  sourceFileName,
  errorMessage
}: {
  projectId: string;
  fileId: string | null;
  sourceFileName: string | null;
  errorMessage: string;
}) {
  const sql = getSql();
  if (fileId) {
    await sql`delete from boq_knowledge where project_id = ${projectId} and file_id = ${fileId}`;
  }
  await sql`
    insert into boq_knowledge (
      project_id, file_id, source_file_name, status, error_message
    )
    values (${projectId}, ${fileId}, ${sourceFileName}, 'failed', ${errorMessage})
  `;
}

/**
 * Build the "learned style" notes that are injected into every generation
 * prompt so new BOQ drafts copy the firm's previous house style.
 */
export function buildKnowledgePromptNotes(rows: BoqKnowledgeRow[]): string[] {
  const analyzed = rows.filter((row) => row.status === "analyzed");
  if (analyzed.length === 0) {
    return [];
  }

  const notes: string[] = [];
  const push = (label: string, value: string | null) => {
    if (value && value.trim().length > 0) {
      notes.push(`${label}: ${value.trim()}`);
    }
  };

  // Merge across all analyzed previous BOQs, preferring the most recent.
  for (const row of analyzed) {
    push("Description writing pattern", row.description_patterns);
    push("Item wording pattern", row.item_wording_patterns);
    push("Trade section structure", row.trade_section_structure);
    push("Heading structure", row.heading_structure);
    push("Item numbering style", row.numbering_style);
    push("Unit usage pattern", row.unit_usage_patterns);
    push("Measurement standard usage", row.measurement_standard_usage);
    push("Standard inclusions", row.inclusions);
    push("Standard exclusions", row.exclusions);
    push("Formatting style", row.formatting_style);
    push("Summary/collection structure", row.summary_structure);

    const samples = (row.sample_items ?? []).slice(0, 8);
    for (const sample of samples) {
      if (sample.description) {
        const unit = sample.unit ? ` [${sample.unit}]` : "";
        notes.push(`Example item from a previous BOQ: ${sample.description}${unit}`);
      }
    }
  }

  return notes;
}
