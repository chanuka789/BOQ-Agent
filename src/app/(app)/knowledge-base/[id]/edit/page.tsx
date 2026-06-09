import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { SCOPES } from "@/lib/agents/catalog";
import { getAppKnowledgeById } from "@/lib/db/app-knowledge";
import { requireCurrentAppUser } from "@/lib/db/users";
import type { AppKnowledgeRow } from "@/lib/db/types";
import { updateKnowledgeAction } from "../../actions";

const FIELDS: Array<{ key: keyof AppKnowledgeRow; label: string }> = [
  { key: "description_patterns", label: "Description patterns" },
  { key: "item_wording_patterns", label: "Item wording patterns" },
  { key: "scope_description_patterns", label: "Scope-specific descriptions" },
  { key: "trade_section_structure", label: "Trade / section structure" },
  { key: "heading_structure", label: "Heading structure" },
  { key: "numbering_style", label: "Numbering style" },
  { key: "unit_usage_patterns", label: "Unit usage patterns" },
  { key: "measurement_standard_usage", label: "Measurement standard usage" },
  { key: "inclusions", label: "Inclusions" },
  { key: "exclusions", label: "Exclusions" },
  { key: "summary_structure", label: "Summary structure" },
  { key: "collection_structure", label: "Collection structure" },
  { key: "cover_page_style", label: "Cover page style" },
  { key: "excel_formatting_style", label: "Excel formatting style" },
  { key: "column_structure", label: "Column structure" },
  { key: "client_company_style", label: "Client / company style" }
];

const SCOPE_OPTIONS = [...SCOPES.map((s) => s.scope), "General"];
const STANDARD_OPTIONS = ["POMI", "NRM2", "NRM1", "Custom"];

export default async function EditKnowledgePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireCurrentAppUser();
    const record = await getAppKnowledgeById(id);
    if (!record) {
      notFound();
    }

    return (
      <>
        <PageHeader
          title="Edit knowledge record"
          description={`${record.scope} · ${record.source_file_name ?? "Previous BOQ"}`}
          action={
            <Link className="btn btn-secondary" href="/knowledge-base">
              Back
            </Link>
          }
        />

        <form action={updateKnowledgeAction} className="panel space-y-5 p-5">
          <input type="hidden" name="id" value={record.id} />

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Scope">
              <select name="scope" defaultValue={record.scope} className="select">
                {SCOPE_OPTIONS.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Measurement standard">
              <select
                name="measurement_standard"
                defaultValue={record.measurement_standard ?? ""}
                className="select"
              >
                <option value="">—</option>
                {STANDARD_OPTIONS.map((standard) => (
                  <option key={standard} value={standard}>
                    {standard}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Section code (optional)">
              <input
                type="text"
                name="section_code"
                defaultValue={record.section_code ?? ""}
                placeholder="e.g. J or 24"
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <textarea
                  name={field.key}
                  defaultValue={(record[field.key] as string | null) ?? ""}
                  rows={3}
                  className="textarea resize-y"
                />
              </Field>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Link className="btn btn-secondary" href="/knowledge-base">
              Cancel
            </Link>
            <button className="btn btn-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Edit knowledge record" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold uppercase text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
