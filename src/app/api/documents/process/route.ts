import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { getProjectFiles } from "@/lib/db/files";
import { assertProjectAccess } from "@/lib/db/projects";
import { getCurrentAppUser } from "@/lib/db/users";
import { processProjectDocuments } from "@/lib/documents/process";
import type { ProjectRow } from "@/lib/db/types";

// Pre-process documents right after upload (called from the browser with auth
// cookies) so generation starts instantly instead of indexing at run time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { projectId } = z
      .object({ projectId: z.string().uuid() })
      .parse(await request.json());
    await assertProjectAccess(projectId, user.id);

    const sql = getSql();
    const rows = (await sql`
      select id, measurement_standard, scope from projects where id = ${projectId} limit 1
    `) as Array<Pick<ProjectRow, "id" | "measurement_standard" | "scope">>;
    const project = rows[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const files = await getProjectFiles(projectId);
    const { processed } = await processProjectDocuments(project, files);

    return NextResponse.json({ processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    console.error("Document pre-processing failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
