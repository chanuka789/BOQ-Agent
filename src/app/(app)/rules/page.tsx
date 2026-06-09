import Link from "next/link";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getSectionAgents } from "@/lib/agents/sections";
import { getRules } from "@/lib/db/rules";
import { requireCurrentAppUser } from "@/lib/db/users";
import { displayUnit } from "@/lib/format";
import type { BoqRuleRow, MeasurementStandard } from "@/lib/db/types";
import { RuleForm } from "./rule-form";
import { deleteRuleAction } from "./actions";

const STANDARDS: MeasurementStandard[] = ["POMI", "NRM2", "NRM1", "Custom"];

function sectionsForForm() {
  const map: Record<string, Array<{ code: string; title: string }>> = {};
  for (const standard of ["POMI", "NRM2", "NRM1"]) {
    map[standard] = getSectionAgents(standard).map((a) => ({ code: a.code, title: a.title }));
  }
  map.Custom = [];
  return map;
}

export default async function RuleLibraryPage({
  searchParams
}: {
  searchParams: Promise<{ standard?: string }>;
}) {
  const { standard: standardParam } = await searchParams;
  const standard = (STANDARDS.includes(standardParam as MeasurementStandard)
    ? standardParam
    : "POMI") as MeasurementStandard;

  try {
    await requireCurrentAppUser();
    const rules = await getRules({ standard });

    // Section label lookup for the active standard.
    const sectionTitle = new Map<string, string>();
    for (const agent of getSectionAgents(standard)) {
      sectionTitle.set(agent.code, agent.title);
    }

    // Group rules by section code (preserving section order, General last).
    const groups = new Map<string, BoqRuleRow[]>();
    for (const rule of rules) {
      const key = rule.section_code ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rule);
    }
    const orderedKeys = [
      ...getSectionAgents(standard).map((a) => a.code).filter((c) => groups.has(c)),
      ...Array.from(groups.keys()).filter(
        (k) => k !== "" && !sectionTitle.has(k)
      ),
      ...(groups.has("") ? [""] : [])
    ];

    return (
      <>
        <PageHeader
          title="BOQ rule library"
          description="App-wide unit and description rules, shared across all projects and organised by measurement-standard section. Rules apply to any project using the matching method."
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {STANDARDS.map((s) => (
            <Link
              key={s}
              href={`/rules?standard=${s}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                s === standard
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
          <section className="panel p-5">
            <div className="mb-5 flex items-center gap-2">
              <Plus size={18} aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[var(--foreground)]">Add rule</h2>
            </div>
            <RuleForm sections={sectionsForForm()} defaultStandard={standard} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                {standard} rules
              </h2>
              <Badge>{rules.length} rules</Badge>
            </div>

            {rules.length === 0 ? (
              <div className="panel p-6 text-sm text-[var(--muted)]">
                No {standard} rules yet. Add rules on the left, or seed them with{" "}
                <code>database/seed_rules.sql</code>.
              </div>
            ) : (
              <div className="space-y-5">
                {orderedKeys.map((key) => (
                  <div key={key || "general"}>
                    <h3 className="mb-2 text-sm font-extrabold text-[var(--foreground)]">
                      {key === ""
                        ? "General (all sections)"
                        : `${standard} ${key} — ${sectionTitle.get(key) ?? "Section"}`}
                    </h3>
                    <div className="table-shell overflow-x-auto">
                      <table className="data-table min-w-[860px]">
                        <thead>
                          <tr>
                            <th>Scope</th>
                            <th>Trade</th>
                            <th>Item type</th>
                            <th>Unit</th>
                            <th>Description rule</th>
                            <th>QS</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groups.get(key)!.map((rule) => (
                            <tr key={rule.id}>
                              <td>{rule.scope}</td>
                              <td className="font-semibold">{rule.trade}</td>
                              <td>{rule.item_type}</td>
                              <td className="font-mono font-bold">{displayUnit(rule.unit)}</td>
                              <td className="max-w-[360px] leading-5">{rule.description_rule}</td>
                              <td>
                                <Badge tone={rule.verified_by_qs ? "success" : "warning"}>
                                  <ShieldCheck size={13} aria-hidden="true" />
                                  {rule.verified_by_qs ? "Verified" : "Review"}
                                </Badge>
                              </td>
                              <td>
                                <form action={deleteRuleAction}>
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
        <PageHeader title="BOQ rule library" />
        <SetupRequired error={error} />
      </>
    );
  }
}
