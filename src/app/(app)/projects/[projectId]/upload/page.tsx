import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectFiles } from "@/lib/db/files";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getProjectTemplates } from "@/lib/db/templates";
import { formatBytes, formatDate } from "@/lib/format";
import { UploadClient } from "./upload-client";

export default async function UploadPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, files, templates] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getProjectFiles(projectId),
      getProjectTemplates(projectId)
    ]);

    return (
      <>
        <PageHeader
          title="Upload documents"
          description={`${project.name} uses ${project.measurement_standard}. Upload project documents and one or more BOQ templates for the agent to match.`}
        />

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <UploadClient projectId={projectId} />

          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  BOQ templates
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Store the current U-View format and future client formats.
                </p>
              </div>
              <Badge tone="info">{templates.length}</Badge>
            </div>

            {templates.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={FileSpreadsheet}
                  title="No BOQ template uploaded"
                  description="Upload the Excel BOQ format so export and item wording can follow the original bill structure."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="font-bold text-[var(--foreground)]">
                      {template.template_name ?? "BOQ template"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {template.template_kind} · {formatDate(template.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Uploaded files
            </h2>
            <Badge>{files.length} files</Badge>
          </div>

          {files.length === 0 ? (
            <EmptyState
              icon={UploadCloud}
              title="No files uploaded"
              description="Add drawings, specifications, schedules, and Excel BOQ templates to begin the workflow."
            />
          ) : (
            <div className="table-shell overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="font-semibold text-[var(--foreground)]">
                        {file.file_name}
                      </td>
                      <td>
                        <Badge tone={file.file_type === "boq_template" ? "info" : "neutral"}>
                          {file.file_type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>{file.mime_type ?? "unknown"}</td>
                      <td>{formatBytes(Number(file.size_bytes))}</td>
                      <td>{file.status}</td>
                      <td>{formatDate(file.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader
          title="Upload documents"
          description="Upload project documents and BOQ templates."
        />
        <SetupRequired error={error} />
      </>
    );
  }
}
