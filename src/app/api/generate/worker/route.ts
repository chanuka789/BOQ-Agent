import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
import { getAIProvider } from "@/lib/ai/providers";
import { extractFileText, getVisionPayload, VisionPayload } from "@/lib/documents/extractor";
import { insertBoqItemsBulk, insertBoqQueriesBulk, insertBoqAssumptionsBulk } from "@/lib/db/boq";
import { getProjectFiles } from "@/lib/db/files";
import { getProjectKnowledge, buildKnowledgePromptNotes } from "@/lib/db/knowledge";
import { getAppKnowledgeNotesForProject } from "@/lib/db/app-knowledge";
import { getRules } from "@/lib/db/rules";
import { getProjectTemplates } from "@/lib/db/templates";
import { buildBoqGeneratorSystemPrompt } from "@/prompts/boq-generator";
import type { ProjectRow } from "@/lib/db/types";

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

    const { projectId, trade, scope, fileIds, jobId, generationId } = await req.json();

    if (!projectId || !trade) {
      return NextResponse.json({ error: "Missing projectId or trade" }, { status: 400 });
    }

    const sql = getSql();

    // 1. Get project details
    const projects = await sql`select * from projects where id = ${projectId} limit 1` as ProjectRow[];
    const project = projects[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Get rules for the project
    const allRules = await getRules({ projectId });
    // Filter rules for this specific trade (case insensitive check)
    const rules = allRules.filter(
      (r) =>
        r.trade.toLowerCase() === trade.toLowerCase() ||
        r.trade.toLowerCase().includes(trade.toLowerCase()) ||
        trade.toLowerCase().includes(r.trade.toLowerCase())
    );

    // 3. Get files for this project/trade
    const allFiles = await getProjectFiles(projectId);
    const targetFiles =
      fileIds && fileIds.length > 0
        ? allFiles.filter((f) => fileIds.includes(f.id))
        : allFiles.filter((f) => f.file_type === "source_document");

    // 4. Extract text content & vision payloads
    const sourceChunks: string[] = [];
    const visionPayloads: VisionPayload[] = [];

    for (const file of targetFiles) {
      const text = await extractFileText(file.storage_url, file.mime_type, file.file_name);
      const label = [file.document_type, file.file_name].filter(Boolean).join(" — ");
      sourceChunks.push(`=== ${label} ===\n${text}`);

      const vision = getVisionPayload(file);
      if (vision) {
        visionPayloads.push(vision);
      }
    }

    if (sourceChunks.length === 0) {
      sourceChunks.push(
        `Project: ${project.name}\nType: ${project.project_type}\nScope: ${project.scope}\nStandard: ${project.measurement_standard}\n\n` +
          `No source documents have been uploaded yet.`
      );
    }

    // 4b. Load the style learned from previous BOQs — both this project's own
    //     knowledge and the app-wide, scope-specific knowledge base.
    const [projectKnowledgeRows, appKnowledgeNotes] = await Promise.all([
      getProjectKnowledge(projectId),
      getAppKnowledgeNotesForProject({
        projectScope: scope ?? project.scope,
        measurementStandard: project.measurement_standard
      })
    ]);
    const knowledgeNotes = [
      ...appKnowledgeNotes,
      ...buildKnowledgePromptNotes(projectKnowledgeRows)
    ];

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

    const tradeSystemPrompt = `
${systemPrompt}

You are a specialized Trade Agent for: **${trade}** under scope **${scope ?? "Architecture + Internal Design"}**.
Your task is to analyze the source documents and generate BOQ items ONLY for the trade: **${trade}**.
Do NOT generate items for any other trades. If the source documents do not contain items for **${trade}**, return an empty list of BOQ items, but you can raise queries or make assumptions if relevant.

Follow the **${project.measurement_standard}** measurement method and these rules for this trade:
${ruleList.length > 0 ? ruleList.map((r) => `- ${r}`).join("\n") : "- No specific trade rules found. Follow " + project.measurement_standard + " requirements and the learned house style for " + trade + "."}
`;

    const userPromptContent: any[] = [
      {
        type: "text",
        text: `
Measurement standard: ${project.measurement_standard}
Target Trade: ${trade}
Target Scope: ${scope ?? "Architecture + Internal Design"}

Template / format instructions:
${templateStyleNotes.map((note) => `- ${note}`).join("\n")}

Source document content:
${sourceChunks.map((chunk, i) => `SOURCE ${i + 1}:\n${chunk}`).join("\n\n")}

Generate the BOQ for **${trade}** only.
Return strict JSON only.
`
      }
    ];

    if (visionPayloads.length > 0) {
      for (const payload of visionPayloads) {
        userPromptContent.push(payload);
      }
    }

    const userPrompt = visionPayloads.length > 0 ? (userPromptContent as any) : userPromptContent[0].text;

    // 7. Call LLM (OpenRouter)
    const ai = getAIProvider();
    const result = await ai.completeJson<GenerationResult>({
      messages: [
        { role: "system", content: tradeSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      maxTokens: 16000
    });

    const boqItems = result.data.boq_items ?? [];
    const queries = result.data.queries ?? [];
    const assumptions = result.data.assumptions ?? [];

    // Filter boqItems to make sure they are only for this trade (safety filter)
    const filteredItems = boqItems.filter(
      (item) =>
        item.trade &&
        (item.trade.toLowerCase() === trade.toLowerCase() ||
          item.trade.toLowerCase().includes(trade.toLowerCase()) ||
          trade.toLowerCase().includes(item.trade.toLowerCase()))
    );

    // 8. Bulk insert into database
    const cleanedItems = filteredItems.map((item) => ({
      item_no: item.item_no ?? null,
      section: item.section || "Architecture + Internal Design",
      trade: trade, // enforce exact trade string
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

    // 9. Save AI Usage
    const promptTokens = result.usage?.promptTokens ?? 0;
    const completionTokens = result.usage?.completionTokens ?? 0;
    const totalTokens = result.usage?.totalTokens ?? 0;
    const estimatedCostUsd = totalTokens * 0.000002;

    await sql`
      insert into ai_usage (
        project_id,
        agent_job_id,
        provider,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        estimated_cost_usd
      )
      values (
        ${projectId},
        ${jobId || null},
        'OpenRouter',
        ${result.model || ai.model},
        ${promptTokens},
        ${completionTokens},
        ${totalTokens},
        ${estimatedCostUsd}
      )
    `;

    return NextResponse.json({
      success: true,
      trade,
      itemsCount: cleanedItems.length,
      queriesCount: cleanedQueries.length,
      assumptionsCount: cleanedAssumptions.length,
      estimatedCostUsd
    });
  } catch (error) {
    console.error("Error in trade worker:", error);
    const message = error instanceof Error ? error.message : "Unknown error in trade worker.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
