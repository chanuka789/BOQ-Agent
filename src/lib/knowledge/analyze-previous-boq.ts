import "server-only";

import { getAIProvider } from "@/lib/ai/providers";
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

    const ai = getAIProvider();
    const result = await ai.completeJson<KnowledgeAnalysis>({
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
      ],
      maxTokens: 8000
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

    // Record token cost for the AI cost meter.
    try {
      const sql = getSql();
      const totalTokens = result.usage?.totalTokens ?? 0;
      await sql`
        insert into ai_usage (project_id, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd)
        values (
          ${project.id}, 'OpenRouter', ${result.model || ai.model},
          ${result.usage?.promptTokens ?? 0}, ${result.usage?.completionTokens ?? 0},
          ${totalTokens}, ${totalTokens * 0.000002}
        )
      `;
    } catch (usageError) {
      console.error("Failed to record knowledge analysis usage:", usageError);
    }

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
