import Link from "next/link";
import { Brain, Library, RefreshCw, Trash2 } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { requireCurrentAppUser } from "@/lib/db/users";
import { getPreviousBoqUploads } from "@/lib/knowledge/analyze-app-upload";
import { formatDate } from "@/lib/format";
import { TrainClient } from "./train-client";
import { deleteUploadAction, reanalyzeUploadAction } from "./actions";

export default async function TrainPage() {
  try {
    await requireCurrentAppUser();
    const uploads = await getPreviousBoqUploads();
    const analysing = uploads.some((u) => u.status === "analyzing" || u.status === "uploaded");

    return (
      <>
        {analysing ? <AutoRefresh /> : null}
        <PageHeader
          title="Train from previous BOQs"
          description="App-wide knowledge training. Upload past bills here once — the learned style is reused by the agents on every project."
          action={
            <Link className="btn btn-secondary" href="/knowledge-base">
              <Brain size={16} aria-hidden="true" />
              View knowledge base
            </Link>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <TrainClient />

          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Uploaded previous BOQs
              </h2>
              <Badge tone="info">{uploads.length}</Badge>
            </div>

            {uploads.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={Library}
                  title="No previous BOQs trained yet"
                  description="Upload a previously prepared bill. It is analysed by discipline scope and stored app-wide for reuse across all projects."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {uploads.map((u) => (
                  <div key={u.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--foreground)]">{u.file_name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {u.measurement_standard ?? "Any method"} · {formatDate(u.created_at)}
                        </p>
                      </div>
                      <UploadStatusBadge status={u.status} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <form action={reanalyzeUploadAction}>
                        <input type="hidden" name="uploadId" value={u.id} />
                        <button className="btn btn-secondary" type="submit">
                          <RefreshCw size={14} aria-hidden="true" />
                          Re-analyse
                        </button>
                      </form>
                      <form action={deleteUploadAction}>
                        <input type="hidden" name="uploadId" value={u.id} />
                        <button className="btn btn-danger" type="submit">
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Train from previous BOQs" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function UploadStatusBadge({ status }: { status: string }) {
  if (status === "analyzed") return <Badge tone="success">Learned</Badge>;
  if (status === "analyzing") return <Badge tone="warning">Analysing…</Badge>;
  if (status === "failed") return <Badge tone="danger">Failed</Badge>;
  return <Badge tone="info">Uploaded</Badge>;
}
