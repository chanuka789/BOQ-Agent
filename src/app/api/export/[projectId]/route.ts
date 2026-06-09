import { NextResponse } from "next/server";
import { getBoqAssumptions, getBoqItems, getBoqQueries } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import {
  getGeneration,
  getLatestGeneration,
  recordGenerationExport,
  updateGenerationStatus,
  upsertAgentLog
} from "@/lib/db/generations";
import { getProjectKnowledge } from "@/lib/db/knowledge";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { buildBoqWorkbook } from "@/lib/export/build-workbook";
import { addActivityLog } from "@/lib/db/activity";
import type { ProjectRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const generationParam = searchParams.get("generation");

  try {
    const user = await requireCurrentAppUser();
    await assertProjectAccess(projectId, user.id);

    const sql = getSql();
    const projectRows = (await sql`
      select * from projects where id = ${projectId} limit 1
    `) as ProjectRow[];
    const project = projectRows[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Resolve the generation: explicit ?generation=, else the latest one.
    const generation = generationParam
      ? await getGeneration(generationParam)
      : await getLatestGeneration(projectId);
    const generationId = generation?.id ?? null;

    if (generation && generation.project_id !== projectId) {
      return NextResponse.json(
        { error: "Generation does not belong to this project." },
        { status: 400 }
      );
    }

    const [items, assumptions, queries, knowledge] = await Promise.all([
      getBoqItems(projectId, generationId),
      getBoqAssumptions(projectId, generationId),
      getBoqQueries(projectId, generationId),
      getProjectKnowledge(projectId)
    ]);

    const buffer = await buildBoqWorkbook({
      project,
      items,
      assumptions,
      queries,
      knowledge,
      generationLabel: generation?.label
    });

    const safeName = project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const genSuffix = generation
      ? `-${generation.label.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")}`
      : "";
    const fileName = `${safeName || "boq"}${genSuffix}-draft.xlsx`;

    // Record the export against the generation so it can be re-downloaded later.
    if (generationId) {
      await recordGenerationExport({
        generationId,
        projectId,
        fileName,
        itemCount: items.length,
        createdBy: user.id
      }).catch(() => {});
      await updateGenerationStatus(generationId, "exported").catch(() => {});
      await upsertAgentLog({
        generationId,
        projectId,
        agentId: "export-agent",
        agentLabel: "Excel Export Agent",
        status: "completed",
        progress: 100,
        statusText: `Formatted ${items.length} item(s) into ${fileName} using the BOQ template and learned style.`
      }).catch(() => {});
    }

    await addActivityLog({
      projectId,
      userId: user.id,
      action: "boq.exported",
      details: { itemCount: items.length, generationId }
    }).catch(() => {});

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build the Excel export.";
    console.error("BOQ export failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
