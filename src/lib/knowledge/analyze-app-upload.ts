import "server-only";

import { resolveScope } from "@/lib/agents/catalog";
import { runAiJson } from "@/lib/ai/run";
import { insertAppKnowledge } from "@/lib/db/app-knowledge";
import { getSql } from "@/lib/db/client";
import { extractFileText } from "@/lib/documents/extractor";
import { parseBoqTemplate } from "@/lib/templates/parser";
import {
  boqKnowledgeSystemPrompt,
  buildBoqKnowledgeUserPrompt
} from "@/prompts/boq-knowledge";
import type { PreviousBoqUploadRow } from "@/lib/db/types";

const MAX_CONTENT_CHARS = 60000;

type ScopeAnalysis = {
  scope?: string;
  description_patterns?: string;
  item_wording_patterns?: string;
  scope_description_patterns?: string;
  inclusions?: string;
  exclusions?: string;
  unit_usage_patterns?: string;
  numbering_style?: string;
  heading_structure?: string;
  sample_items?: Array<{ item_no?: string; description?: string; unit?: string; section?: string }>;
  detected_units?: string[];
};

type FullKnowledgeAnalysis = {
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
  collection_structure?: string;
  cover_page_style?: string;
  excel_formatting_style?: string;
  column_structure?: string;
  client_company_style?: string;
  sample_items?: Array<{ item_no?: string; description?: string; unit?: string; section?: string }>;
  detected_units?: string[];
  scopes?: ScopeAnalysis[];
};

function isExcel(name: string, mime: string) {
  const n = name.toLowerCase();
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsm")
  );
}

/**
 * Analyse an APP-WIDE previous BOQ upload (not tied to a project) and store the
 * learned knowledge in app_knowledge_base, reusable for ALL projects. The
 * measurement_standard is left null so the knowledge applies across standards
 * unless the upload declared one.
 */
export async function analyzePreviousBoqUpload(
  upload: PreviousBoqUploadRow
): Promise<{ success: boolean; error?: string }> {
  const sql = getSql();
  try {
    await sql`update previous_boq_uploads set status = 'analyzing', updated_at = now() where id = ${upload.id}`;

    if (!upload.storage_url) {
      throw new Error("Upload has no storage URL.");
    }

    const content = (await extractFileText(upload.storage_url, null, upload.file_name)).slice(
      0,
      MAX_CONTENT_CHARS
    );

    let structureNotes: string[] = [];
    let structureUnits: string[] = [];
    if (isExcel(upload.file_name, "")) {
      try {
        const resp = await fetch(upload.storage_url);
        if (resp.ok) {
          const parsed = await parseBoqTemplate(await resp.arrayBuffer());
          structureUnits = parsed.detectedUnits;
          structureNotes = parsed.sheets
            .slice(0, 8)
            .map(
              (s) =>
                `Sheet "${s.name}" (${s.kind}); columns: ${Object.keys(s.columns).join(", ") || "none"}.`
            );
        }
      } catch {
        /* non-fatal */
      }
    }

    const result = await runAiJson<FullKnowledgeAnalysis>({
      task: "knowledge_base_extraction",
      maxTokens: 8000,
      messages: [
        { role: "system", content: boqKnowledgeSystemPrompt },
        {
          role: "user",
          content: buildBoqKnowledgeUserPrompt({
            fileName: upload.file_name,
            declaredStandard: upload.measurement_standard ?? "Unknown (detect from document)",
            structureNotes,
            content
          })
        }
      ]
    });

    const analysis = result.data ?? {};
    const detectedUnits = Array.from(
      new Set([...(analysis.detected_units ?? []), ...structureUnits])
    );

    // Replace any prior knowledge from this upload, then store per scope.
    await sql`delete from app_knowledge_base where upload_id = ${upload.id}`;

    const scopeAnalyses: ScopeAnalysis[] =
      analysis.scopes && analysis.scopes.length > 0 ? analysis.scopes : [{ scope: "General" }];

    for (const scopeAnalysis of scopeAnalyses) {
      const scopeDef = resolveScope(scopeAnalysis.scope);
      await insertAppKnowledge({
        agentId: scopeDef.agentId,
        scope: scopeDef.scope,
        measurementStandard: upload.measurement_standard ?? null,
        uploadId: upload.id,
        sourceFileName: upload.file_name,
        description_patterns:
          scopeAnalysis.description_patterns ?? analysis.description_patterns ?? null,
        item_wording_patterns:
          scopeAnalysis.item_wording_patterns ?? analysis.item_wording_patterns ?? null,
        trade_section_structure: analysis.trade_section_structure ?? null,
        heading_structure: scopeAnalysis.heading_structure ?? analysis.heading_structure ?? null,
        numbering_style: scopeAnalysis.numbering_style ?? analysis.numbering_style ?? null,
        unit_usage_patterns:
          scopeAnalysis.unit_usage_patterns ?? analysis.unit_usage_patterns ?? null,
        measurement_standard_usage: analysis.measurement_standard_usage ?? null,
        scope_description_patterns: scopeAnalysis.scope_description_patterns ?? null,
        inclusions: scopeAnalysis.inclusions ?? analysis.inclusions ?? null,
        exclusions: scopeAnalysis.exclusions ?? analysis.exclusions ?? null,
        summary_structure: analysis.summary_structure ?? null,
        collection_structure: analysis.collection_structure ?? null,
        cover_page_style: analysis.cover_page_style ?? null,
        excel_formatting_style: analysis.excel_formatting_style ?? analysis.formatting_style ?? null,
        column_structure: analysis.column_structure ?? null,
        client_company_style: analysis.client_company_style ?? null,
        sample_items: scopeAnalysis.sample_items ?? analysis.sample_items ?? [],
        detected_units:
          scopeAnalysis.detected_units && scopeAnalysis.detected_units.length > 0
            ? scopeAnalysis.detected_units
            : detectedUnits
      });
    }

    await sql`update previous_boq_uploads set status = 'analyzed', error_message = null, updated_at = now() where id = ${upload.id}`;
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error analysing previous BOQ.";
    console.error(`App-wide previous BOQ analysis failed for ${upload.file_name}:`, error);
    await sql`update previous_boq_uploads set status = 'failed', error_message = ${message}, updated_at = now() where id = ${upload.id}`.catch(
      () => {}
    );
    return { success: false, error: message };
  }
}

export async function getPreviousBoqUploads(): Promise<PreviousBoqUploadRow[]> {
  const sql = getSql();
  const rows = (await sql`
    select * from previous_boq_uploads order by created_at desc
  `) as PreviousBoqUploadRow[];
  return rows;
}

export async function getPreviousBoqUploadById(id: string): Promise<PreviousBoqUploadRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from previous_boq_uploads where id = ${id} limit 1
  `) as PreviousBoqUploadRow[];
  return rows[0] ?? null;
}
