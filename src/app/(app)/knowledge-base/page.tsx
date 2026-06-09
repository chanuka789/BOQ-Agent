import Link from "next/link";
import { Brain, CheckCircle2, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/status-badge";
import { getAppKnowledge } from "@/lib/db/app-knowledge";
import { requireCurrentAppUser } from "@/lib/db/users";
import { formatDate } from "@/lib/format";
import type { AppKnowledgeRow } from "@/lib/db/types";
import {
  activateKnowledgeAction,
  approveKnowledgeAction,
  deleteKnowledgeAction,
  disableKnowledgeAction
} from "./actions";

export const maxDuration = 60;

const ASPECTS: Array<{ key: keyof AppKnowledgeRow; label: string }> = [
  { key: "description_patterns", label: "Description patterns" },
  { key: "item_wording_patterns", label: "Item wording" },
  { key: "scope_description_patterns", label: "Scope-specific descriptions" },
  { key: "trade_section_structure", label: "Trade/section structure" },
  { key: "heading_structure", label: "Heading structure" },
  { key: "numbering_style", label: "Numbering style" },
  { key: "unit_usage_patterns", label: "Unit usage" },
  { key: "measurement_standard_usage", label: "Measurement standard usage" },
  { key: "inclusions", label: "Inclusions" },
  { key: "exclusions", label: "Exclusions" },
  { key: "summary_structure", label: "Summary structure" },
  { key: "collection_structure", label: "Collection structure" },
  { key: "cover_page_style", label: "Cover page style" },
  { key: "excel_formatting_style", label: "Excel formatting" },
  { key: "column_structure", label: "Column structure" },
  { key: "client_company_style", label: "Client/company style" }
];

export default async function KnowledgeBasePage({
  searchParams
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: scopeFilter } = await searchParams;

  try {
    await requireCurrentAppUser();
    const records = await getAppKnowledge({
      includeDisabled: true,
      scope: scopeFilter
    });
    const allForCounts = scopeFilter
      ? await getAppKnowledge({ includeDisabled: true })
      : records;

    // Scope chips with counts.
    const scopeCounts = new Map<string, number>();
    for (const row of allForCounts) {
      scopeCounts.set(row.scope, (scopeCounts.get(row.scope) ?? 0) + 1);
    }
    const scopes = Array.from(scopeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <>
        <PageHeader
          title="Knowledge base"
          description="App-wide BOQ knowledge learned from previous BOQs, reused by the agents on every project. Approving a record also adds matching rules to the BOQ rule library. Approve, edit, disable, or delete records here."
          action={
            <Link className="btn btn-primary" href="/knowledge-base/train">
              <Brain size={16} aria-hidden="true" />
              Train from previous BOQs
            </Link>
          }
        />

        {allForCounts.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No learned knowledge yet"
            description="Upload previous BOQs from a project's Previous BOQs page. Each is analysed by discipline scope and stored here, app-wide, for reuse across all projects."
          />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap gap-2">
              <ScopeChip
                label="All scopes"
                count={allForCounts.length}
                href="/knowledge-base"
                active={!scopeFilter}
              />
              {scopes.map(([scope, count]) => (
                <ScopeChip
                  key={scope}
                  label={scope}
                  count={count}
                  href={`/knowledge-base?scope=${encodeURIComponent(scope)}`}
                  active={scopeFilter === scope}
                />
              ))}
            </div>

            {records.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No records for this scope.</p>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <KnowledgeCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Knowledge base" />
        <SetupRequired error={error} />
      </>
    );
  }
}

function ScopeChip({
  label,
  count,
  href,
  active
}: {
  label: string;
  count: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--foreground)]"
      }`}
    >
      {label} · {count}
    </Link>
  );
}

function StatusBadge({ status }: { status: AppKnowledgeRow["status"] }) {
  if (status === "approved") return <Badge tone="success">Approved</Badge>;
  if (status === "disabled") return <Badge tone="neutral">Disabled</Badge>;
  return <Badge tone="info">Active</Badge>;
}

function KnowledgeCard({ record }: { record: AppKnowledgeRow }) {
  const aspects = ASPECTS.map((aspect) => ({
    label: aspect.label,
    value: record[aspect.key] as string | null
  })).filter((aspect) => aspect.value && aspect.value.trim().length > 0);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              {record.scope}
            </h2>
            <StatusBadge status={record.status} />
            {record.measurement_standard ? (
              <Badge tone="info">{record.measurement_standard}</Badge>
            ) : null}
            {record.section_code ? (
              <Badge>§{record.section_code}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {record.source_file_name ?? "Previous BOQ"} · agent {record.agent_id} ·
            added {formatDate(record.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="btn btn-secondary"
            href={`/knowledge-base/${record.id}/edit`}
          >
            <Pencil size={15} aria-hidden="true" />
            Edit
          </Link>
          {record.status !== "approved" ? (
            <form action={approveKnowledgeAction}>
              <input type="hidden" name="id" value={record.id} />
              <button className="btn btn-secondary" type="submit">
                <CheckCircle2 size={15} aria-hidden="true" />
                Approve
              </button>
            </form>
          ) : null}
          {record.status === "disabled" ? (
            <form action={activateKnowledgeAction}>
              <input type="hidden" name="id" value={record.id} />
              <button className="btn btn-secondary" type="submit">
                <Power size={15} aria-hidden="true" />
                Enable
              </button>
            </form>
          ) : (
            <form action={disableKnowledgeAction}>
              <input type="hidden" name="id" value={record.id} />
              <button className="btn btn-secondary" type="submit">
                <PowerOff size={15} aria-hidden="true" />
                Disable
              </button>
            </form>
          )}
          <form action={deleteKnowledgeAction}>
            <input type="hidden" name="id" value={record.id} />
            <button className="btn btn-danger" type="submit">
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          </form>
        </div>
      </div>

      {record.detected_units && record.detected_units.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase text-[var(--muted)]">Units</span>
          {record.detected_units.map((unit) => (
            <span
              key={unit}
              className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-xs font-bold"
            >
              {unit}
            </span>
          ))}
        </div>
      ) : null}

      {aspects.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">
            {aspects.length} learned aspect{aspects.length === 1 ? "" : "s"}
          </summary>
          <dl className="mt-3 grid gap-3 md:grid-cols-2">
            {aspects.map((aspect) => (
              <div
                key={aspect.label}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
              >
                <dt className="text-xs font-extrabold uppercase text-[var(--muted)]">
                  {aspect.label}
                </dt>
                <dd className="mt-1 text-sm leading-6 text-[var(--foreground)]">
                  {aspect.value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
