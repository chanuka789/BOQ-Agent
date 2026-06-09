import { PageHeader } from "@/components/page-header";
import { createProjectAction } from "@/app/(app)/projects/actions";
import { NewProjectWizard } from "./wizard";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        title="New project"
        description="Set the project identity and measurement standard before documents or AI generation are added."
      />
      <NewProjectWizard action={createProjectAction} />
    </>
  );
}
