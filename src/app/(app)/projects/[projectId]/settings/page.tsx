import { Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { updateProjectAction } from "./actions";

export default async function ProjectSettingsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const { project } = await getProjectForCurrentUser(projectId);

    return (
      <>
        <PageHeader
          title="Project settings"
          description={`Manage details and standard rules for ${project.name}.`}
        />

        <div className="max-w-3xl space-y-6">
          <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning)] flex gap-3">
            <Info className="shrink-0 mt-0.5" size={16} aria-hidden="true" />
            <div>
              <p className="font-bold">Important Notice</p>
              <p className="mt-1 leading-5">
                Changing the measurement standard affects how new BOQ items are drafted by the AI generator. Already generated BOQ items will not be retroactively modified.
              </p>
            </div>
          </div>

          <form action={updateProjectAction} className="panel p-6 space-y-4">
            <input type="hidden" name="projectId" value={projectId} />

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">Project name</span>
                <input
                  className="input"
                  name="name"
                  defaultValue={project.name}
                  required
                />
              </label>

              <label>
                <span className="label">Client name</span>
                <input
                  className="input"
                  name="clientName"
                  defaultValue={project.client_name}
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">Project type</span>
                <input
                  className="input"
                  name="projectType"
                  defaultValue={project.project_type}
                  required
                />
              </label>

              <label>
                <span className="label">Scope</span>
                <input
                  className="input"
                  name="scope"
                  defaultValue={project.scope}
                  required
                />
              </label>
            </div>

            <div>
              <span className="label">Measurement standard</span>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {[
                  {
                    value: "POMI",
                    label: "POMI",
                    desc: "Common regional measurement structure for building works."
                  },
                  {
                    value: "NRM2",
                    label: "NRM2",
                    desc: "Detailed measurement rules for building works procurement."
                  },
                  {
                    value: "NRM1",
                    label: "NRM1 cost plan",
                    desc: "Cost planning structure before detailed BOQ production."
                  },
                  {
                    value: "Custom",
                    label: "Custom",
                    desc: "Use when your office or client has a specific rule set."
                  }
                ].map((std) => (
                  <label
                    key={std.value}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-white p-4 cursor-pointer hover:border-[#b8c7d8] transition"
                  >
                    <input
                      type="radio"
                      name="measurementStandard"
                      value={std.value}
                      defaultChecked={project.measurement_standard === std.value}
                      className="mt-1"
                    />
                    <div>
                      <span className="block text-sm font-extrabold text-[var(--foreground)]">
                        {std.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                        {std.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4 flex justify-end">
              <button className="btn btn-primary" type="submit">
                Save settings
              </button>
            </div>
          </form>
        </div>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Project settings" />
        <SetupRequired error={error} />
      </>
    );
  }
}
