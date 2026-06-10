import "server-only";

import { estimateCost, isQualityMode, type QualityMode } from "@/lib/ai/model-config";
import { runAiJson } from "@/lib/ai/run";
import { getSql } from "@/lib/db/client";
import { insertBoqAssumptionsBulk, insertBoqItemsBulk, insertBoqQueriesBulk } from "@/lib/db/boq";
import { getProjectFiles } from "@/lib/db/files";
import { getAppKnowledgeNotesForProject } from "@/lib/db/app-knowledge";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { extractFileText, getVisionPayload, type VisionPayload } from "@/lib/documents/extractor";
import { getAgentContext } from "@/lib/documents/retrieve";
import { buildBoqGeneratorSystemPrompt } from "@/prompts/boq-generator";
import type { SectionAgent } from "@/lib/agents/sections";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

type GenerationResult = {
  decision_summary?: string;
  reasoning?: string;
  boq_items?: Array<{
    item_no?: string;
    section?: string;
    trade?: string;
    item_type?: string;
    description?: string;
    unit?: string;
    source_reference?: string;
    confidence_score?: number;
    review_status?: "draft" | "needs_review";
  }>;
  assumptions?: Array<{ assumption?: string; source_reference?: string }>;
  queries?: Array<{
    issue?: string;
    clarification_needed?: string;
    source_reference?: string;
  }>;
};

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export type SectionAgentResult = {
  success: boolean;
  trade: string;
  model?: string;
  reasoning?: string;
  itemsCount: number;
  queriesCount: number;
  assumptionsCount: number;
  estimatedCostUsd: number;
  error?: string;
};

export async function runSectionAgent({
  projectId,
  trade,
  scope,
  fileIds,
  generationId,
  agent,
  briefNote,
  qualityMode
}: {
  projectId: string;
  trade: string;
  scope?: string | null;
  fileIds?: string[];
  generationId?: string | null;
  agent?: Partial<SectionAgent> & { agentId?: string };
  briefNote?: string;
  qualityMode?: QualityMode | string;
}): Promise<SectionAgentResult> {
  if (!projectId || !trade) {
    throw new Error("Missing projectId or trade.");
  }

  const mode: QualityMode = isQualityMode(qualityMode) ? qualityMode : "balanced";
  const sectionCode = agent?.code ?? "";
  const sectionTitle = agent?.title ?? trade;
  const sectionLabel = agent?.label ?? `${trade} Agent`;
  const sectionUnits = agent?.units ?? [];

  const sql = getSql();
  const projects = (await sql`
    select * from projects where id = ${projectId} limit 1
  `) as ProjectRow[];
  const project = projects[0];
  if (!project) {
    throw new Error("Project not found.");
  }

  const allRules = await getRules({ projectId });
  const isSectionAgent = sectionCode !== "";
  const rules = isSectionAgent
    ? allRules.filter((r) => !r.section_code || r.section_code === sectionCode)
    : allRules.filter(
        (r) =>
          r.trade.toLowerCase() === trade.toLowerCase() ||
          r.trade.toLowerCase().includes(trade.toLowerCase()) ||
          trade.toLowerCase().includes(r.trade.toLowerCase())
      );

  const agentScope = agent?.scope ?? scope ?? project.scope;
  const sourceChunks: string[] = [];
  const visionPayloads: VisionPayload[] = [];
  let sourceRefs: string[] = [];

  const context = await getAgentContext({
    projectId,
    scope: agentScope,
    sectionCode: sectionCode || null,
    trade: sectionTitle,
    keywords: [sectionTitle, ...sectionUnits],
    maxChunks: envNumber("SECTION_AGENT_MAX_CHUNKS", 18)
  });

  if (context.hasContent) {
    sourceChunks.push(context.contextText);
    sourceRefs = context.refs;
  } else {
    const allFiles = await getProjectFiles(projectId);
    const targetFiles =
      fileIds && fileIds.length > 0
        ? allFiles.filter((f: ProjectFileRow) => fileIds.includes(f.id))
        : allFiles.filter((f: ProjectFileRow) => f.file_type === "source_document");

    for (const file of targetFiles) {
      const text = await extractFileText(file.storage_url, file.mime_type, file.file_name);
      const label = [file.document_type, file.file_name].filter(Boolean).join(" - ");
      sourceChunks.push(`=== ${label} ===\n${text}`);
      const vision = getVisionPayload(file);
      if (vision) visionPayloads.push(vision);
    }
  }

  if (sourceChunks.length === 0) {
    sourceChunks.push(
      `Project: ${project.name}\nType: ${project.project_type}\nScope: ${project.scope}\nStandard: ${project.measurement_standard}\n\n` +
        "No source documents have been uploaded yet."
    );
  }

  const knowledgeNotes = await getAppKnowledgeNotesForProject({
    projectScope: agentScope,
    measurementStandard: project.measurement_standard
  });

  const templates = await getProjectTemplates(projectId);
  const templateStyleNotes: string[] = templates.flatMap((t) => {
    const parsed = t.parsed_structure as {
      status?: string;
      styleNotes?: string[];
      workSheetCount?: number;
      summarySheetCount?: number;
      detectedUnits?: string[];
    };
    return [
      t.template_name ? `Template: ${t.template_name}` : null,
      t.sheet_name ? `Primary bill sheet: ${t.sheet_name}` : null,
      t.header_row ? `Template header row: ${t.header_row}` : null,
      t.description_column ? `Description column: ${t.description_column}` : null,
      t.unit_column ? `Unit column: ${t.unit_column}` : null,
      parsed?.workSheetCount ? `Detected ${parsed.workSheetCount} work sheet(s)` : null,
      parsed?.summarySheetCount ? `Detected ${parsed.summarySheetCount} summary/index sheet(s)` : null,
      ...(Array.isArray(parsed?.styleNotes) ? parsed.styleNotes.slice(0, 8) : [])
    ].filter((x): x is string => Boolean(x));
  });

  if (templateStyleNotes.length === 0) {
    templateStyleNotes.push(
      `Measurement standard: ${project.measurement_standard}. Follow standard QS conventions.`
    );
  }

  const ruleList = rules.map(
    (r) =>
      `${r.scope} > ${r.trade} > ${r.item_type}: unit=${r.unit}, rule="${r.description_rule}"` +
      (r.inclusions ? ` [incl: ${r.inclusions}]` : "") +
      (r.exclusions ? ` [excl: ${r.exclusions}]` : "")
  );

  const systemPrompt = buildBoqGeneratorSystemPrompt({
    measurementStandard: project.measurement_standard,
    knowledgeNotes
  });

  const standard = project.measurement_standard;
  const isNrm1 = standard === "NRM1";
  const unitsHint =
    sectionUnits.length > 0 ? ` Typical units for this section: ${sectionUnits.join(", ")}.` : "";

  let agentFocus: string;
  if (isNrm1 && isSectionAgent) {
    agentFocus = `
You are the ${sectionLabel} for NRM1 cost planning.
Produce ELEMENTAL COST-PLAN descriptions for NRM1 element ${sectionCode} - ${sectionTitle} ONLY.
This is cost planning, NOT detailed measurement: describe the element and its scope
at cost-plan level (elemental). Do NOT produce fine-grained measured BOQ items unless
the documents clearly support them.${unitsHint}
Quantities, rates and cost/m2 must remain blank. Set section = "NRM1 ${sectionCode} - ${sectionTitle}".
If this element is not present in the project, return an empty boq_items list.`;
  } else if (isSectionAgent) {
    agentFocus = `
You are the ${sectionLabel}.
Generate BOQ items for ${standard} ${sectionCode} - ${sectionTitle} ONLY (discipline scope: ${agent?.scope ?? scope}).
Do NOT generate items belonging to any other ${standard} section. If the source documents
contain no ${sectionTitle} work, return an empty boq_items list (you may still raise queries
or assumptions).${unitsHint}
Set section = "${standard} ${sectionCode} - ${sectionTitle}" on every item.`;
  } else {
    agentFocus = `
You are a specialized Trade Agent for: ${trade} under scope ${scope ?? "Architecture + Internal Design"}.
Generate BOQ items ONLY for the trade ${trade}. If the documents contain no items for
${trade}, return an empty boq_items list (you may still raise queries or assumptions).`;
  }

  const tradeSystemPrompt = `
${systemPrompt}
${agentFocus}

Follow the ${standard} measurement method and these rules:
${
  ruleList.length > 0
    ? ruleList.map((r) => `- ${r}`).join("\n")
    : `- No seeded rules for this section. Follow ${standard} requirements and the learned house style.`
}
`;

  const userText = `
Measurement standard: ${project.measurement_standard}
Target agent: ${sectionLabel}
${isSectionAgent ? `Target section: ${project.measurement_standard} ${sectionCode} - ${sectionTitle}` : `Target trade: ${trade}`}
Discipline scope: ${agent?.scope ?? scope ?? "Architecture + Internal Design"}

${briefNote ? `Lead coordinator plan for this agent: ${briefNote}\n` : ""}
Template / format instructions:
${templateStyleNotes.map((note) => `- ${note}`).join("\n")}
${
  sourceRefs.length > 0
    ? `\nAvailable source references (cite the relevant one in each item's source_reference):\n${sourceRefs.map((r) => `- ${r}`).join("\n")}\n`
    : ""
}
Retrieved source content (already filtered to this agent's scope/section):
${sourceChunks.map((chunk, i) => `SOURCE ${i + 1}:\n${chunk}`).join("\n\n")}

Generate the BOQ for this agent's remit only. Put the drawing/page/spec/schedule
reference of each item into its source_reference. Return strict JSON only.
`;

  const userPrompt =
    visionPayloads.length > 0
      ? [
          { type: "text", text: userText },
          ...visionPayloads
        ]
      : userText;

  const result = await runAiJson<GenerationResult>({
    task: "section_agent_processing",
    mode,
    reasoning: false,
    messages: [
      { role: "system", content: tradeSystemPrompt },
      { role: "user", content: userPrompt }
    ],
    maxTokens: envNumber("SECTION_AGENT_MAX_TOKENS", 9000),
    context: { projectId, generationId, agentId: agent?.agentId ?? `trade-${trade}` }
  });

  const agentReasoning = (
    result.data.decision_summary ??
    result.data.reasoning ??
    result.reasoning ??
    ""
  ).trim();

  const boqItems = result.data.boq_items ?? [];
  const queries = result.data.queries ?? [];
  const assumptions = result.data.assumptions ?? [];

  const filteredItems = isSectionAgent
    ? boqItems
    : boqItems.filter(
        (item) =>
          item.trade &&
          (item.trade.toLowerCase() === trade.toLowerCase() ||
            item.trade.toLowerCase().includes(trade.toLowerCase()) ||
            trade.toLowerCase().includes(item.trade.toLowerCase()))
      );

  const sectionHeading = isSectionAgent
    ? `${project.measurement_standard} ${sectionCode} - ${sectionTitle}`
    : null;

  const cleanedItems = filteredItems
    .map((item) => ({
      item_no: item.item_no ?? null,
      section: sectionHeading ?? (item.section || "Architecture + Internal Design"),
      trade: sectionTitle,
      item_type: item.item_type || "measured",
      description: (item.description ?? "").trim(),
      unit: item.unit === "-" ? "" : (item.unit ?? "").trim(),
      source_reference: item.source_reference?.trim() || null,
      confidence_score: item.confidence_score ?? 0.8,
      review_status: (item.review_status ?? "draft") as "draft" | "needs_review"
    }))
    .filter((item) => item.description.length > 0);

  await insertBoqItemsBulk(projectId, cleanedItems, generationId);

  const cleanedQueries = queries
    .map((q) => ({
      issue: (q.issue ?? "").trim(),
      clarification_needed: (q.clarification_needed ?? "").trim(),
      source_reference: q.source_reference?.trim() || null
    }))
    .filter((q) => q.issue.length > 0 && q.clarification_needed.length > 0);
  await insertBoqQueriesBulk(projectId, cleanedQueries, generationId);

  const cleanedAssumptions = assumptions
    .map((a) => ({
      assumption: (a.assumption ?? "").trim(),
      source_reference: a.source_reference?.trim() || null
    }))
    .filter((a) => a.assumption.length > 0);
  await insertBoqAssumptionsBulk(projectId, cleanedAssumptions, generationId);

  const totalTokens = result.usage?.totalTokens ?? 0;
  const estimatedCostUsd = estimateCost(
    result.model,
    result.usage?.promptTokens ?? 0,
    result.usage?.completionTokens ?? 0
  );

  return {
    success: true,
    trade,
    model: result.model,
    reasoning: agentReasoning,
    itemsCount: cleanedItems.length,
    queriesCount: cleanedQueries.length,
    assumptionsCount: cleanedAssumptions.length,
    estimatedCostUsd: estimatedCostUsd || totalTokens * 0.000002
  };
}
