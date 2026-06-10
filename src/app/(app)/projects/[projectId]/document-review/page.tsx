import { FileSearch, Layers, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectChunkStats, getProjectSchedules } from "@/lib/db/documents";
import { getProjectFiles } from "@/lib/db/files";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { processDocumentsAction, updateClassificationAction } from "./actions";

export const maxDuration = 60;

const documentTypes = [
  "Specification",
  "Drawing",
  "Door schedule",
  "Finish schedule",
  "Room data sheet",
  "Previous BOQ",
  "BOQ template",
  "Other"
];

export default async function DocumentReviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, files, chunkStats, schedules] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getProjectFiles(projectId),
      getProjectChunkStats(projectId),
      getProjectSchedules(projectId)
    ]);
    const sourceFiles = files.filter((f) => f.file_type === "source_document");

    return (
      <>
        <PageHeader
          title="Document review"
          description={`Confirm classifications, then build the structured knowledge layer for ${project.name}.`}
          action={
            sourceFiles.length > 0 ? (
              <form action={processDocumentsAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <button className="btn btn-primary" type="submit">
                  <Sparkles size={16} aria-hidden="true" />
                  Process documents
                </button>
              </form>
            ) : undefined
          }
        />

        {sourceFiles.length > 0 ? (
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <StatCard icon={Layers} label="Indexed chunks" value={chunkStats?.chunks ?? 0} />
            <StatCard icon={FileSearch} label="Documents indexed" value={chunkStats?.files ?? 0} />
            <StatCard icon={Layers} label="Structured schedules" value={schedules.length} />
          </div>
        ) : null}

        {files.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No files to classify"
            description="Upload documents first, then return here to confirm type and scope."
            actionHref={`/projects/${projectId}/upload`}
            actionLabel="Upload files"
          />
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Role</th>
                  <th>Document type</th>
                  <th>Scope</th>
                  <th>Confidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td className="max-w-[280px] font-semibold text-[var(--foreground)]">
                      {file.file_name}
                    </td>
                    <td>
                      <Badge tone={file.file_type === "boq_template" ? "info" : "neutral"}>
                        {file.file_type.replace("_", " ")}
                      </Badge>
                    </td>
                    <td>
                      <ClassificationForm
                        projectId={projectId}
                        fileId={file.id}
                        field="documentType"
                        defaultValue={
                          file.document_type ??
                          (file.file_type === "boq_template"
                            ? "BOQ template"
                            : "Other")
                        }
                        otherValue={file.scope ?? project.scope}
                      />
                    </td>
                    <td>
                      <ClassificationForm
                        projectId={projectId}
                        fileId={file.id}
                        field="scope"
                        defaultValue={file.scope ?? project.scope}
                        otherValue={
                          file.document_type ??
                          (file.file_type === "boq_template"
                            ? "BOQ template"
                            : "Other")
                        }
                      />
                    </td>
                    <td>
                      {file.classification_confidence
                        ? `${Math.round(file.classification_confidence * 100)}%`
                        : "Manual"}
                    </td>
                    <td>
                      <Badge tone={file.status === "classified" ? "success" : "warning"}>
                        {file.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {schedules.length > 0 ? (
          <section className="mt-6">
            <h2 className="mb-3 text-base font-extrabold text-[var(--foreground)]">
              Structured schedules
            </h2>
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[var(--foreground)]">
                      {schedule.schedule_type.replace("_", " ")} schedule
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                        {schedule.source_file_name} · {schedule.rows.length} rows
                      </span>
                    </p>
                    {schedule.scope ? <Badge tone="info">{schedule.scope}</Badge> : null}
                  </div>
                  {schedule.rows.length > 0 ? (
                    <p className="mt-2 truncate font-mono text-xs text-[var(--muted)]">
                      {(schedule.columns ?? []).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader
          title="Document review"
          description="Confirm document classifications before extraction."
        />
        <SetupRequired error={error} />
      </>
    );
  }
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-extrabold uppercase text-[var(--muted)]">{label}</p>
        <p className="text-xl font-extrabold text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

function ClassificationForm({
  projectId,
  fileId,
  field,
  defaultValue,
  otherValue
}: {
  projectId: string;
  fileId: string;
  field: "documentType" | "scope";
  defaultValue: string;
  otherValue: string;
}) {
  return (
    <form action={updateClassificationAction} className="flex gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="fileId" value={fileId} />
      <input
        type="hidden"
        name={field === "documentType" ? "scope" : "documentType"}
        value={otherValue}
      />
      {field === "documentType" ? (
        <select className="select min-w-44" name="documentType" defaultValue={defaultValue}>
          {documentTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      ) : (
        <input className="input min-w-56" name="scope" defaultValue={defaultValue} />
      )}
      <button className="btn btn-secondary min-h-9" type="submit">
        Save
      </button>
    </form>
  );
}
