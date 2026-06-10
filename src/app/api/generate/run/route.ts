import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { runBoqGeneration } from "@/lib/generation/run-boq-generation";

// The coordinator does heavier work than a server action's lifetime allows
// (document processing, project-understanding reasoning, spawning agents, QA).
// Running it in its own route gives it a long maxDuration budget.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-worker-secret");
  const expected = process.env.INTERNAL_WORKER_SECRET || "boq-agent-secret-123";
  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, jobId, generationId } = await req.json();
  if (!projectId || !jobId) {
    return NextResponse.json({ error: "Missing projectId or jobId" }, { status: 400 });
  }

  // Run after the response so this route returns immediately; the work continues
  // within this invocation's maxDuration.
  after(() => runBoqGeneration(projectId, jobId, generationId ?? null));

  return NextResponse.json({ ok: true });
}
