import { NextRequest, NextResponse } from "next/server";
import { verifyInternalWorkerSecret } from "@/lib/generation/internal-worker-secret";
import { runSectionAgent } from "@/lib/generation/run-section-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    verifyInternalWorkerSecret(req.headers.get("x-worker-secret"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }

  try {
    const body = await req.json();
    const result = await runSectionAgent({
      projectId: body.projectId,
      trade: body.trade,
      scope: body.scope,
      fileIds: body.fileIds,
      generationId: body.generationId,
      agent: body.agent,
      briefNote: typeof body.briefNote === "string" ? body.briefNote : "",
      qualityMode: body.qualityMode
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in section-agent worker:", error);
    const message = error instanceof Error ? error.message : "Unknown error in section-agent worker.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
