import { FileSearch } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectFiles } from "@/lib/db/files";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { updateClassificationAction } from "./actions";

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
    const [{ project }, files] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getProjectFiles(projectId)
    ]);

    return (
      <>
        <PageHeader
          title="Document review"
          description={`Confirm document types and scope before extraction for ${project.name}.`}
        />

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
