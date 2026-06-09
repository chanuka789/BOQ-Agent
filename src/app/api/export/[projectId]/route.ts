import { NextResponse } from "next/server";
import { getBoqAssumptions, getBoqItems, getBoqQueries } from "@/lib/db/boq";
import { getSql } from "@/lib/db/client";
import { getProjectKnowledge } from "@/lib/db/knowledge";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { buildBoqWorkbook } from "@/lib/export/build-workbook";
import { addActivityLog } from "@/lib/db/activity";
import type { ProjectRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

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

    const [items, assumptions, queries, knowledge] = await Promise.all([
      getBoqItems(projectId),
      getBoqAssumptions(projectId),
      getBoqQueries(projectId),
      getProjectKnowledge(projectId)
    ]);

    const buffer = await buildBoqWorkbook({
      project,
      items,
      assumptions,
      queries,
      knowledge
    });

    await addActivityLog({
      projectId,
      userId: user.id,
      action: "boq.exported",
      details: { itemCount: items.length }
    }).catch(() => {});

    await sql`
      update projects set status = 'exported', updated_at = now()
      where id = ${projectId} and status = 'ready_for_review'
    `.catch(() => {});

    const safeName = project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const fileName = `${safeName || "boq"}-draft.xlsx`;

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
