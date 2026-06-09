import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createProjectAction } from "@/app/(app)/projects/actions";
import { NewProjectWizard } from "./wizard";

export default async function NewProjectPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        title="New project"
        description="Set the project identity and measurement standard before documents or AI generation are added."
      />
      {error ? (
        <div className="mb-6 max-w-4xl rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)] flex gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={16} aria-hidden="true" />
          <div>
            <p className="font-bold">Failed to create project</p>
            <p className="mt-1 leading-5">{decodeURIComponent(error)}</p>
          </div>
        </div>
      ) : null}
      <NewProjectWizard action={createProjectAction} />
    </>
  );
}
