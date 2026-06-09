import { RotateCcw, Trash2, Layers, FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getDeletedGenerationsForUser } from "@/lib/db/generations";
import { getDeletedProjectsForUser } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";
import { formatDate } from "@/lib/format";
import {
  permanentlyDeleteGenerationAction,
  permanentlyDeleteProjectAction,
  restoreGenerationAction,
  restoreProjectAction
} from "./actions";

export default async function RecycleBinPage() {
  try {
    const user = await requireCurrentAppUser();
    const [projects, generations] = await Promise.all([
      getDeletedProjectsForUser(user.id),
      getDeletedGenerationsForUser(user.id)
    ]);

    const isEmpty = projects.length === 0 && generations.length === 0;

    return (
      <>
        <PageHeader
          title="Recycle Bin"
          description="Restore deleted projects and BOQ generations, or delete them permanently. App-wide previous-BOQ knowledge is never removed from here."
        />

        {isEmpty ? (
          <EmptyState
            icon={Trash2}
            title="Recycle Bin is empty"
            description="Deleted projects and BOQ generations appear here and can be restored until you permanently delete them."
          />
        ) : (
          <div className="space-y-6">
            <section className="panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <FolderKanban size={17} aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  Deleted projects
                </h2>
                <Badge>{projects.length}</Badge>
              </div>
              {projects.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No deleted projects.</p>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
                    >
                      <div>
                        <p className="font-bold text-[var(--foreground)]">{project.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {project.client_name} · deleted{" "}
                          {project.deleted_at ? formatDate(project.deleted_at) : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={restoreProjectAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="btn btn-secondary" type="submit">
                            <RotateCcw size={15} aria-hidden="true" />
                            Restore
                          </button>
                        </form>
                        <form action={permanentlyDeleteProjectAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <button className="btn btn-danger" type="submit">
                            <Trash2 size={15} aria-hidden="true" />
                            Delete permanently
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <Layers size={17} aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  Deleted BOQ generations
                </h2>
                <Badge>{generations.length}</Badge>
              </div>
              {generations.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No deleted generations.</p>
              ) : (
                <div className="space-y-3">
                  {generations.map((generation) => (
                    <div
                      key={generation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
                    >
                      <div>
                        <p className="font-bold text-[var(--foreground)]">
                          {generation.label}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {generation.project_name} · {generation.measurement_standard} ·{" "}
                          {generation.item_count} items · deleted{" "}
                          {generation.deleted_at ? formatDate(generation.deleted_at) : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={restoreGenerationAction}>
                          <input type="hidden" name="generationId" value={generation.id} />
                          <button className="btn btn-secondary" type="submit">
                            <RotateCcw size={15} aria-hidden="true" />
                            Restore
                          </button>
                        </form>
                        <form action={permanentlyDeleteGenerationAction}>
                          <input type="hidden" name="generationId" value={generation.id} />
                          <button className="btn btn-danger" type="submit">
                            <Trash2 size={15} aria-hidden="true" />
                            Delete permanently
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Recycle Bin" />
        <SetupRequired error={error} />
      </>
    );
  }
}
