import "server-only";

import { runAiJson } from "@/lib/ai/run";
import { resolveScope } from "@/lib/agents/catalog";
import { insertAppKnowledge } from "@/lib/db/app-knowledge";
import { getSql } from "@/lib/db/client";
import {
  recordKnowledgeFailure,
  upsertKnowledgeFromAnalysis,
  type KnowledgeAnalysis
} from "@/lib/db/knowledge";
import { extractFileText } from "@/lib/documents/extractor";
import { parseBoqTemplate } from "@/lib/templates/parser";
import {
  boqKnowledgeSystemPrompt,
  buildBoqKnowledgeUserPrompt
} from "@/prompts/boq-knowledge";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

// The analysis the model returns: the document-level KnowledgeAnalysis plus the
// richer app-wide fields and a per-scope breakdown.
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

type FullKnowledgeAnalysis = KnowledgeAnalysis & {
  collection_structure?: string;
  cover_page_style?: string;
  excel_formatting_style?: string;
  column_structure?: string;
  client_company_style?: string;
  scopes?: ScopeAnalysis[];
};

// Keep the prompt within model limits — a full bill can be very large.
const MAX_CONTENT_CHARS = 60000;

function isExcel(file: Pick<ProjectFileRow, "mime_type" | "file_name">) {
  const ct = (file.mime_type ?? "").toLowerCase();
  const name = file.file_name.toLowerCase();
  return (
    ct.includes("spreadsheet") ||
    ct.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm")
  );
}

async function buildStructureNotes(
  file: ProjectFileRow
): Promise<{ notes: string[]; detectedUnits: string[] }> {
  if (!isExcel(file)) {
    return { notes: [], detectedUnits: [] };
  }

  try {
    const resp = await fetch(file.storage_url);
    if (!resp.ok) {
      return { notes: [], detectedUnits: [] };
    }
    const arrayBuffer = await resp.arrayBuffer();
    const parsed = await parseBoqTemplate(arrayBuffer);

    const notes: string[] = [
      `Work sheets: ${parsed.workSheetCount}, summary sheets: ${parsed.summarySheetCount}, index sheets: ${parsed.indexSheetCount}.`,
      ...parsed.sheets.slice(0, 8).map((sheet) => {
        const cols = Object.keys(sheet.columns).join(", ") || "none detected";
        return `Sheet "${sheet.name}" (${sheet.kind}); header row ${sheet.headerRow ?? "?"}; columns: ${cols}.`;
      })
    ];

    return { notes, detectedUnits: parsed.detectedUnits };
  } catch (error) {
    console.error("Previous BOQ structure parse failed:", error);
    return { notes: [], detectedUnits: [] };
  }
}

export async function analyzePreviousBoqFile(
  project: Pick<ProjectRow, "id" | "measurement_standard">,
  file: ProjectFileRow
): Promise<{ success: boolean; error?: string }> {
  try {
    const [content, structure] = await Promise.all([
      extractFileText(file.storage_url, file.mime_type, file.file_name),
      buildStructureNotes(file)
    ]);

    const trimmedContent = content.slice(0, MAX_CONTENT_CHARS);

    const result = await runAiJson<FullKnowledgeAnalysis>({
      task: "previous_boq_analysis",
      maxTokens: 8000,
      context: { projectId: project.id },
      messages: [
        { role: "system", content: boqKnowledgeSystemPrompt },
        {
          role: "user",
          content: buildBoqKnowledgeUserPrompt({
            fileName: file.file_name,
            declaredStandard: project.measurement_standard,
            structureNotes: structure.notes,
            content: trimmedContent
          })
        }
      ]
    });

    const analysis = result.data ?? {};
    // Merge spreadsheet-detected units with the model's units.
    const detectedUnits = Array.from(
      new Set([...(analysis.detected_units ?? []), ...structure.detectedUnits])
    );

    await upsertKnowledgeFromAnalysis({
      projectId: project.id,
      fileId: file.id,
      sourceFileName: file.file_name,
      measurementStandard: project.measurement_standard,
      analysis: { ...analysis, detected_units: detectedUnits }
    });

    // ── App-wide, per-scope knowledge base ──────────────────────────────────
    // Register the upload app-wide, then store one knowledge row per discipline
    // scope so future projects in any discipline can reuse the learned style.
    try {
      const sql = getSql();
      const uploadRows = (await sql`
        insert into previous_boq_uploads (
          origin_project_id, file_id, file_name, storage_url, measurement_standard, status
        )
        values (
          ${project.id}, ${file.id}, ${file.file_name}, ${file.storage_url},
          ${project.measurement_standard}, 'analyzed'
        )
        on conflict do nothing
        returning id
      `) as Array<{ id: string }>;
      const uploadId = uploadRows[0]?.id ?? null;

      const scopeAnalyses: ScopeAnalysis[] =
        analysis.scopes && analysis.scopes.length > 0
          ? analysis.scopes
          : [{ scope: "General" }];

      for (const scopeAnalysis of scopeAnalyses) {
        const scopeDef = resolveScope(scopeAnalysis.scope);
        await insertAppKnowledge({
          agentId: scopeDef.agentId,
          scope: scopeDef.scope,
          measurementStandard: project.measurement_standard,
          uploadId,
          sourceFileName: file.file_name,
          description_patterns:
            scopeAnalysis.description_patterns ?? analysis.description_patterns ?? null,
          item_wording_patterns:
            scopeAnalysis.item_wording_patterns ?? analysis.item_wording_patterns ?? null,
          trade_section_structure: analysis.trade_section_structure ?? null,
          heading_structure:
            scopeAnalysis.heading_structure ?? analysis.heading_structure ?? null,
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
          excel_formatting_style:
            analysis.excel_formatting_style ?? analysis.formatting_style ?? null,
          column_structure: analysis.column_structure ?? null,
          client_company_style: analysis.client_company_style ?? null,
          sample_items: scopeAnalysis.sample_items ?? analysis.sample_items ?? [],
          detected_units:
            scopeAnalysis.detected_units && scopeAnalysis.detected_units.length > 0
              ? scopeAnalysis.detected_units
              : detectedUnits,
          raw_analysis: scopeAnalysis as Record<string, unknown>
        });
      }
    } catch (appKnowledgeError) {
      console.error("Failed to write app-wide knowledge:", appKnowledgeError);
    }

    // Token cost is logged centrally by the model router (ai_model_usage_logs).

    // Mark the file as processed so the UI reflects that it was learned from.
    try {
      const sql = getSql();
      await sql`update project_files set status = 'indexed', updated_at = now() where id = ${file.id}`;
    } catch {
      /* non-fatal */
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error analysing previous BOQ.";
    console.error(`Previous BOQ analysis failed for ${file.file_name}:`, error);
    await recordKnowledgeFailure({
      projectId: project.id,
      fileId: file.id,
      sourceFileName: file.file_name,
      errorMessage: message
    }).catch(() => {});
    return { success: false, error: message };
  }
}
