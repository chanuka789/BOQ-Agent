import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { ProjectStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getProjectsForCurrentUser } from "@/lib/db/projects";

export default async function DashboardPage() {
  let projects;

  try {
    projects = await getProjectsForCurrentUser();
  } catch (error) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Create projects, track upload progress, and move BOQ drafts into review."
        />
        <SetupRequired error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Create projects, track upload progress, and move BOQ drafts into review."
        action={
          <Link className="btn btn-primary" href="/projects/new">
            <Plus size={16} aria-hidden="true" />
            New project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Create your first BOQ project"
          description="Start with project details and measurement standard, then upload documents and templates for the QS review workflow."
          actionHref="/projects/new"
          actionLabel="Create your first project"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/upload`}
              className="card block p-5 transition hover:border-[#b8c7d8] hover:shadow-[var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold text-[var(--foreground)]">
                    {project.name}
                  </h2>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">
                    {project.client_name}
                  </p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Metric label="Standard" value={project.measurement_standard} />
                <Metric label="Files" value={String(project.file_count ?? 0)} />
                <Metric label="Items" value={String(project.item_count ?? 0)} />
                <Metric label="Updated" value={formatDate(project.updated_at)} />
              </dl>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-extrabold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
