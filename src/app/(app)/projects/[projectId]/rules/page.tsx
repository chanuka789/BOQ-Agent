import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getProjectForCurrentUser } from "@/lib/db/projects";
import { getRules } from "@/lib/db/rules";
import { displayUnit } from "@/lib/format";
import { createRuleAction, deleteRuleAction } from "./actions";

export default async function RulesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  try {
    const [{ project }, rules] = await Promise.all([
      getProjectForCurrentUser(projectId),
      getRules({ projectId })
    ]);

    return (
      <>
        <PageHeader
          title="BOQ rule library"
          description={`Rules are the source of truth for units and description structure under ${project.measurement_standard}. A qualified QS should verify seeded rules before production use.`}
        />

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <section className="panel p-5">
            <div className="mb-5 flex items-center gap-2">
              <Plus size={18} aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Add rule
              </h2>
            </div>
            <form action={createRuleAction} className="space-y-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="measurementStandard"
                value={project.measurement_standard}
              />
              <Field label="Scope" name="scope" defaultValue={project.scope} />
              <Field label="Trade" name="trade" placeholder="Doors" />
              <Field label="Item type" name="itemType" placeholder="Door set" />
              <Field label="Unit" name="unit" placeholder="nr, item, m2, kg" />
              <label>
                <span className="label">Description rule</span>
                <textarea
                  className="textarea"
                  name="descriptionRule"
                  placeholder="Describe size, type, material, reference, finish, rating, and location where applicable."
                  required
                />
              </label>
              <Field label="Inclusions" name="inclusions" required={false} />
              <Field label="Exclusions" name="exclusions" required={false} />
              <button className="btn btn-primary w-full" type="submit">
                Add rule
              </button>
            </form>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Rules for this standard
              </h2>
              <Badge>{rules.length} rules</Badge>
            </div>
            <div className="table-shell overflow-x-auto">
              <table className="data-table min-w-[940px]">
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th>Item type</th>
                    <th>Unit</th>
                    <th>Description rule</th>
                    <th>QS verified</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="font-semibold">{rule.trade}</td>
                      <td>{rule.item_type}</td>
                      <td className="font-mono font-bold">
                        {displayUnit(rule.unit)}
                      </td>
                      <td className="max-w-[420px] leading-5">
                        {rule.description_rule}
                      </td>
                      <td>
                        <Badge tone={rule.verified_by_qs ? "success" : "warning"}>
                          <ShieldCheck size={13} aria-hidden="true" />
                          {rule.verified_by_qs ? "Verified" : "Needs QS review"}
                        </Badge>
                      </td>
                      <td>
                        <form action={deleteRuleAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <button
                            className="btn btn-secondary min-h-9 px-3 text-[var(--danger)]"
                            type="submit"
                            title="Delete rule"
                            aria-label={`Delete ${rule.trade} rule`}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader
          title="BOQ rule library"
          description="Manage units and description rules."
        />
        <SetupRequired error={error} />
      </>
    );
  }
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = true
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="input"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}
