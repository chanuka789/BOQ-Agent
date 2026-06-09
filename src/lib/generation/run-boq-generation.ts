import "server-only";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { getAIProvider } from "@/lib/ai/providers";
import {
  insertBoqAssumption,
  insertBoqItem,
  insertBoqQuery,
  updateAgentJob
} from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import {
  boqGeneratorSystemPrompt,
  buildBoqGeneratorUserPrompt
} from "@/prompts/boq-generator";
import type { ProjectRow, ReviewStatus } from "@/lib/db/types";

type GenerationResult = {
  boq_items?: Array<{
    section: string;
    trade: string;
    item_type: string;
    description: string;
    unit: string;
    source_reference?: string;
    confidence_score?: number;
    review_status?: "draft" | "needs_review";
  }>;
  assumptions?: Array<{ assumption: string; source_reference?: string }>;
  queries?: Array<{
    issue: string;
    clarification_needed: string;
    source_reference?: string;
  }>;
};

async function getProjectById(projectId: string): Promise<ProjectRow | null> {
  const sql = getSql();
  const rows = (await sql`
    select * from projects where id = ${projectId} limit 1
  `) as ProjectRow[];
  return rows[0] ?? null;
}

async function extractFileText(
  storageUrl: string,
  mimeType: string | null,
  fileName: string
): Promise<string> {
  try {
    const resp = await fetch(storageUrl);
    if (!resp.ok) return `[File: ${fileName} — fetch failed]`;

    const ct = (mimeType ?? resp.headers.get("content-type") ?? "").toLowerCase();
    const name = fileName.toLowerCase();

    // Excel
    if (
      ct.includes("spreadsheet") ||
      ct.includes("excel") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")
    ) {
      const buf = await resp.arrayBuffer();
      const wb = XLSX.read(buf);
      return wb.SheetNames.map(
        (s) => `Sheet: ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`
      ).join("\n\n");
    }

    // CSV / plain text
    if (ct.includes("text") || name.endsWith(".txt") || name.endsWith(".csv")) {
      const text = await resp.text();
      return text.slice(0, 10000);
    }

    // PDF — best-effort readable-text extraction
    if (ct.includes("pdf") || name.endsWith(".pdf")) {
      const raw = await resp.text();
      const readable = raw.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
      if (readable.length > 200) {
        return `[PDF: ${fileName}]\n${readable.slice(0, 8000)}`;
      }
      return `[PDF: ${fileName} — binary, using filename as context only]`;
    }

    return `[File: ${fileName}, type: ${ct}]`;
  } catch {
    return `[File: ${fileName} — extraction error]`;
  }
}

export async function runBoqGeneration(projectId: string, jobId: string): Promise<void> {
  try {
    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Loading project data",
      progress: 5
    });

    const [project, allFiles, rules, templates] = await Promise.all([
      getProjectById(projectId),
      getProjectFiles(projectId),
      getRules({ projectId }),
      getProjectTemplates(projectId)
    ]);

    if (!project) throw new Error("Project not found.");

    const sourceFiles = allFiles.filter((f) => f.file_type === "source_document");

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: `Extracting content from ${sourceFiles.length} document(s)`,
      progress: 20
    });

    const sourceChunks: string[] = [];
    for (const file of sourceFiles) {
      const text = await extractFileText(file.storage_url, file.mime_type, file.file_name);
      const label = [file.document_type, file.file_name].filter(Boolean).join(" — ");
      sourceChunks.push(`=== ${label} ===\n${text}`);
    }

    const noSourceDocs = sourceChunks.length === 0;
    if (noSourceDocs) {
      sourceChunks.push(
        `Project: ${project.name}\nType: ${project.project_type}\nScope: ${project.scope}\nStandard: ${project.measurement_standard}\n\n` +
          `No source documents have been uploaded yet. You MUST still generate a representative skeleton BOQ for this project type and scope. ` +
          `Set review_status to "needs_review" on every item to flag them for QS review. ` +
          `Do NOT respond with only queries — produce concrete BOQ items first, then add queries only for specific ambiguities you cannot resolve from the project metadata.`
      );
    }

    const ruleList = rules.map(
      (r) =>
        `${r.scope} › ${r.trade} › ${r.item_type}: unit=${r.unit}, rule="${r.description_rule}"` +
        (r.inclusions ? ` [incl: ${r.inclusions}]` : "") +
        (r.exclusions ? ` [excl: ${r.exclusions}]` : "")
    );

    const templateStyleNotes: string[] = templates.flatMap((t) =>
      [
        t.template_name ? `Template: ${t.template_name}` : null,
        t.numbering_style ? `Numbering style: ${t.numbering_style}` : null,
        t.sheet_name ? `Sheet: ${t.sheet_name}` : null
      ].filter((x): x is string => x !== null)
    );

    if (templateStyleNotes.length === 0) {
      templateStyleNotes.push(
        `Measurement standard: ${project.measurement_standard}. Follow standard QS conventions.`
      );
    }

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: "Running AI generation",
      progress: 40
    });

    const ai = getAIProvider();
    const result = await ai.completeJson<GenerationResult>({
      messages: [
        { role: "system", content: boqGeneratorSystemPrompt },
        {
          role: "user",
          content: buildBoqGeneratorUserPrompt({
            measurementStandard: project.measurement_standard,
            templateStyleNotes,
            ruleList,
            sourceChunks
          })
        }
      ],
      maxTokens: 8000
    });

    const boqItems = result.data.boq_items ?? [];
    const queries = result.data.queries ?? [];
    const assumptions = result.data.assumptions ?? [];

    await updateAgentJob(jobId, {
      status: "running",
      currentStep: `Saving ${boqItems.length} BOQ items to database`,
      progress: 75
    });

    for (const item of boqItems) {
      await insertBoqItem(projectId, {
        ...item,
        review_status: (item.review_status ?? "draft") as ReviewStatus
      });
    }
    for (const q of queries) {
      await insertBoqQuery(projectId, q);
    }
    for (const a of assumptions) {
      await insertBoqAssumption(projectId, a);
    }

    const costEstimate =
      result.usage?.totalTokens != null ? result.usage.totalTokens * 0.000002 : undefined;

    await updateAgentJob(jobId, {
      status: "completed",
      currentStep: `${boqItems.length} items · ${queries.length} queries · ${assumptions.length} assumptions`,
      progress: 100,
      message: `Completed. Model: ${result.model}`,
      estimatedCostUsd: costEstimate
    });

    revalidatePath(`/projects/${projectId}/generate`);
    revalidatePath(`/projects/${projectId}/boq-review`);
    revalidatePath(`/projects/${projectId}/queries`);
    revalidatePath(`/projects/${projectId}/assumptions`);
  } catch (error) {
    console.error("BOQ generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error during generation.";
    await updateAgentJob(jobId, {
      status: "failed",
      currentStep: "Generation failed",
      progress: 0,
      message
    }).catch(() => {});
  }
}
