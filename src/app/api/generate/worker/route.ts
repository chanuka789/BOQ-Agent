import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
import { runAiJson } from "@/lib/ai/run";
import { estimateCost, isQualityMode, type QualityMode } from "@/lib/ai/model-config";
import { extractFileText, getVisionPayload, VisionPayload } from "@/lib/documents/extractor";
import { insertBoqItemsBulk, insertBoqQueriesBulk, insertBoqAssumptionsBulk } from "@/lib/db/boq";
import { getProjectFiles } from "@/lib/db/files";
import { getAppKnowledgeNotesForProject } from "@/lib/db/app-knowledge";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { getAgentContext } from "@/lib/documents/retrieve";
import { buildBoqGeneratorSystemPrompt } from "@/prompts/boq-generator";
import type { ProjectFileRow, ProjectRow } from "@/lib/db/types";

type GenerationResult = {
  boq_items?: Array<{
    item_no?: string;
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

export async function POST(req: NextRequest) {
  try {
    // Basic verification using shared secret header
    const secret = req.headers.get("x-worker-secret");
    const expectedSecret = process.env.INTERNAL_WORKER_SECRET || "boq-agent-secret-123";
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, trade, scope, fileIds, jobId, generationId, agent } = body;
    const qualityMode: QualityMode = isQualityMode(body.qualityMode)
      ? body.qualityMode
      : "balanced";

    if (!projectId || !trade) {
      return NextResponse.json({ error: "Missing projectId or trade" }, { status: 400 });
    }

    // Agent metadata from the coordinator (section/NRM1/custom).
    const sectionCode: string = agent?.code ?? "";
    const sectionTitle: string = agent?.title ?? trade;
    const sectionLabel: string = agent?.label ?? `${trade} Agent`;
    const sectionUnits: string[] = agent?.units ?? [];

    const sql = getSql();

    // 1. Get project details
    const projects = await sql`select * from projects where id = ${projectId} limit 1` as ProjectRow[];
    const project = projects[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Get rules for the project's measurement standard.
    const allRules = await getRules({ projectId });
    // Section agents get the rules for their measurement-standard section plus
    // any general (section-less) rules; legacy custom trade agents keep the
    // trade-filtered subset.
    const isSectionAgent = sectionCode !== "";
    const rules = isSectionAgent
      ? allRules.filter((r) => !r.section_code || r.section_code === sectionCode)
      : allRules.filter(
          (r) =>
            r.trade.toLowerCase() === trade.toLowerCase() ||
            r.trade.toLowerCase().includes(trade.toLowerCase()) ||
            trade.toLowerCase().includes(r.trade.toLowerCase())
        );

    // 3 + 4. LAYER 3 — Agent Retrieval. Pull only the chunks/schedules relevant
    // to this agent's scope and section, instead of passing whole documents.
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
      maxChunks: 16
    });

    if (context.hasContent) {
      sourceChunks.push(context.contextText);
      sourceRefs = context.refs;
    } else {
      // Backward-compatible fallback: documents not yet processed into chunks —
      // extract full text as before (older projects / pre-processing).
      const allFiles = await getProjectFiles(projectId);
      const targetFiles =
        fileIds && fileIds.length > 0
          ? allFiles.filter((f: ProjectFileRow) => fileIds.includes(f.id))
          : allFiles.filter((f: ProjectFileRow) => f.file_type === "source_document");

      for (const file of targetFiles) {
        const text = await extractFileText(file.storage_url, file.mime_type, file.file_name);
        const label = [file.document_type, file.file_name].filter(Boolean).join(" — ");
        sourceChunks.push(`=== ${label} ===\n${text}`);
        const vision = getVisionPayload(file);
        if (vision) visionPayloads.push(vision);
      }
    }

    if (sourceChunks.length === 0) {
      sourceChunks.push(
        `Project: ${project.name}\nType: ${project.project_type}\nScope: ${project.scope}\nStandard: ${project.measurement_standard}\n\n` +
          `No source documents have been uploaded yet.`
      );
    }

    // 4b. Load the style learned from previous BOQs — the app-wide,
    //     scope-specific knowledge base (trained from the Knowledge base page).
    const knowledgeNotes = await getAppKnowledgeNotesForProject({
      projectScope: scope ?? project.scope,
      measurementStandard: project.measurement_standard
    });

    // 5. Build template style notes
    const templates = await getProjectTemplates(projectId);
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

    // 6. Build the prompt customized for this trade
    const ruleList = rules.map(
      (r) =>
        `${r.scope} › ${r.trade} › ${r.item_type}: unit=${r.unit}, rule="${r.description_rule}"` +
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

    // Build the section / scope focus that narrows this agent to its remit only.
    let agentFocus: string;
    if (isNrm1 && isSectionAgent) {
      agentFocus = `
You are the **${sectionLabel}** for NRM1 cost planning.
Produce ELEMENTAL COST-PLAN descriptions for NRM1 element **${sectionCode} — ${sectionTitle}** ONLY.
This is cost planning, NOT detailed measurement: describe the element and its scope
at cost-plan level (elemental). Do NOT produce fine-grained measured BOQ items unless
the documents clearly support them.${unitsHint}
Quantities, rates and cost/m2 must remain blank. Set section = "NRM1 ${sectionCode} — ${sectionTitle}".
If this element is not present in the project, return an empty boq_items list.`;
    } else if (isSectionAgent) {
      agentFocus = `
You are the **${sectionLabel}**.
Generate BOQ items for **${standard} ${sectionCode} — ${sectionTitle}** ONLY (discipline scope: ${agent?.scope ?? scope}).
Do NOT generate items belonging to any other ${standard} section. If the source documents
contain no ${sectionTitle} work, return an empty boq_items list (you may still raise queries
or assumptions).${unitsHint}
Set section = "${standard} ${sectionCode} — ${sectionTitle}" on every item.`;
    } else {
      agentFocus = `
You are a specialized Trade Agent for: **${trade}** under scope **${scope ?? "Architecture + Internal Design"}**.
Generate BOQ items ONLY for the trade **${trade}**. If the documents contain no items for
**${trade}**, return an empty boq_items list (you may still raise queries or assumptions).`;
    }

    const tradeSystemPrompt = `
${systemPrompt}
${agentFocus}

Follow the **${standard}** measurement method and these rules:
${ruleList.length > 0 ? ruleList.map((r) => `- ${r}`).join("\n") : "- No seeded rules for this section. Follow " + standard + " requirements and the learned house style."}
`;

    const userPromptContent: any[] = [
      {
        type: "text",
        text: `
Measurement standard: ${project.measurement_standard}
Target agent: ${sectionLabel}
${isSectionAgent ? `Target section: ${project.measurement_standard} ${sectionCode} — ${sectionTitle}` : `Target trade: ${trade}`}
Discipline scope: ${agent?.scope ?? scope ?? "Architecture + Internal Design"}

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
`
      }
    ];

    if (visionPayloads.length > 0) {
      for (const payload of visionPayloads) {
        userPromptContent.push(payload);
      }
    }

    const userPrompt = visionPayloads.length > 0 ? (userPromptContent as any) : userPromptContent[0].text;

    // 7. Call LLM via the model router (task + quality mode pick the model,
    //    with fallback and cost logging handled centrally).
    const result = await runAiJson<GenerationResult>({
      task: "section_agent_processing",
      mode: qualityMode,
      messages: [
        { role: "system", content: tradeSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 16000,
      context: { projectId, generationId, agentId: agent?.agentId ?? `trade-${trade}` }
    });

    const boqItems = result.data.boq_items ?? [];
    const queries = result.data.queries ?? [];
    const assumptions = result.data.assumptions ?? [];

    // Section agents are already narrowly focused, so trust their output and
    // re-tag the section. Legacy custom trade agents keep the trade safety filter.
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
      ? `${project.measurement_standard} ${sectionCode} — ${sectionTitle}`
      : null;

    // 8. Bulk insert into database
    const cleanedItems = filteredItems.map((item) => ({
      item_no: item.item_no ?? null,
      section: sectionHeading ?? (item.section || "Architecture + Internal Design"),
      trade: sectionTitle, // group under the section/trade title
      item_type: item.item_type || "measured",
      description: item.description,
      unit: item.unit === "-" ? "" : item.unit,
      source_reference: item.source_reference ?? null,
      confidence_score: item.confidence_score ?? 0.8,
      review_status: (item.review_status ?? "draft") as any
    }));

    await insertBoqItemsBulk(projectId, cleanedItems, generationId);

    const cleanedQueries = queries.map((q) => ({
      issue: q.issue,
      clarification_needed: q.clarification_needed,
      source_reference: q.source_reference ?? null
    }));
    await insertBoqQueriesBulk(projectId, cleanedQueries, generationId);

    const cleanedAssumptions = assumptions.map((a) => ({
      assumption: a.assumption,
      source_reference: a.source_reference ?? null
    }));
    await insertBoqAssumptionsBulk(projectId, cleanedAssumptions, generationId);

    // 9. Cost/usage is logged centrally by the model router (ai_model_usage_logs).
    const totalTokens = result.usage?.totalTokens ?? 0;
    const estimatedCostUsd = estimateCost(
      result.model,
      result.usage?.promptTokens ?? 0,
      result.usage?.completionTokens ?? 0
    );

    return NextResponse.json({
      success: true,
      trade,
      model: result.model,
      itemsCount: cleanedItems.length,
      queriesCount: cleanedQueries.length,
      assumptionsCount: cleanedAssumptions.length,
      estimatedCostUsd: estimatedCostUsd || totalTokens * 0.000002
    });
  } catch (error) {
    console.error("Error in trade worker:", error);
    const message = error instanceof Error ? error.message : "Unknown error in trade worker.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
