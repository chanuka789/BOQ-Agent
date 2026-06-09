"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { LockedCell } from "@/components/locked-cell";
import {
  Badge,
  ConfidenceBadge,
  ReviewStatusBadge
} from "@/components/status-badge";
import type { BoqItemRow, ReviewStatus } from "@/lib/db/types";
import { displayUnit, reviewStatusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateBoqItemAction } from "./actions";

const statuses: ReviewStatus[] = [
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "revised"
];

export function BoqReviewClient({
  projectId,
  initialItems,
  queryCount,
  assumptionCount
}: {
  projectId: string;
  initialItems: BoqItemRow[];
  queryCount: number;
  assumptionCount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [trade, setTrade] = useState("all");
  const [isPending, startTransition] = useTransition();

  const trades = useMemo(
    () => Array.from(new Set(items.map((item) => item.trade))).sort(),
    [items]
  );
  const filtered = useMemo(() => {
    const query = keyword.toLowerCase();

    return items.filter((item) => {
      const matchesKeyword =
        !query ||
        item.description.toLowerCase().includes(query) ||
        item.trade.toLowerCase().includes(query) ||
        (item.source_reference ?? "").toLowerCase().includes(query);
      const matchesStatus = status === "all" || item.review_status === status;
      const matchesTrade = trade === "all" || item.trade === trade;

      return matchesKeyword && matchesStatus && matchesTrade;
    });
  }, [items, keyword, status, trade]);

  function updateItem(itemId: string, patch: Partial<BoqItemRow>) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );

    startTransition(() => {
      void updateBoqItemAction({
        projectId,
        itemId,
        description: patch.description,
        unit: patch.unit,
        reviewStatus: patch.review_status
      });
    });
  }

  function bulkStatus(nextStatus: ReviewStatus) {
    filtered.forEach((item) => updateItem(item.id, { review_status: nextStatus }));
  }

  return (
    <section>
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="relative block">
            <span className="sr-only">Search items</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              className="input pl-9"
              placeholder="Search items"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <select
            className="select"
            value={trade}
            onChange={(event) => setTrade(event.target.value)}
            aria-label="Filter by trade"
          >
            <option value="all">All trades</option>
            {trades.map((tradeOption) => (
              <option key={tradeOption} value={tradeOption}>
                {tradeOption}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ReviewStatus | "all")
            }
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {statuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {reviewStatusLabel(statusOption)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => bulkStatus("approved")}
          >
            <Check size={16} aria-hidden="true" />
            Bulk approve
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => bulkStatus("rejected")}
          >
            Bulk reject
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Summary label="Visible items" value={filtered.length} />
        <Summary label="Total items" value={items.length} />
        <Summary label="Queries" value={queryCount} />
        <Summary label="Assumptions" value={assumptionCount} />
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[1280px]">
          <thead>
            <tr>
              <th>Item no.</th>
              <th>Section / trade</th>
              <th>Type</th>
              <th>Description</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  item.confidence_score < 0.68 && "bg-[var(--warning-soft)]/45"
                )}
              >
                <td className="font-mono text-xs">{item.item_no ?? "-"}</td>
                <td>
                  <p className="font-semibold text-[var(--foreground)]">
                    {item.section}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.trade}</p>
                </td>
                <td>
                  <Badge>{item.item_type}</Badge>
                </td>
                <td className="min-w-[360px]">
                  <textarea
                    className="textarea min-h-20 resize-y"
                    value={item.description}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.id === item.id
                            ? { ...row, description: event.target.value }
                            : row
                        )
                      )
                    }
                    onBlur={(event) =>
                      updateItem(item.id, {
                        description: event.target.value,
                        review_status:
                          item.review_status === "draft"
                            ? "revised"
                            : item.review_status
                      })
                    }
                  />
                </td>
                <td className="min-w-28">
                  <input
                    className="input font-mono font-bold"
                    value={item.unit}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.id === item.id
                            ? { ...row, unit: event.target.value }
                            : row
                        )
                      )
                    }
                    onBlur={(event) =>
                      updateItem(item.id, {
                        unit: event.target.value,
                        review_status:
                          item.review_status === "draft"
                            ? "revised"
                            : item.review_status
                      })
                    }
                    aria-label={`Unit for ${item.description}`}
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {displayUnit(item.unit)}
                  </p>
                </td>
                <td>
                  <LockedCell />
                </td>
                <td>
                  <LockedCell />
                </td>
                <td>
                  <LockedCell />
                </td>
                <td className="max-w-[160px] text-xs text-[var(--primary)]">
                  {item.source_reference ?? "No source"}
                </td>
                <td>
                  <ConfidenceBadge value={item.confidence_score} />
                </td>
                <td className="min-w-44">
                  <select
                    className="select"
                    value={item.review_status}
                    onChange={(event) =>
                      updateItem(item.id, {
                        review_status: event.target.value as ReviewStatus
                      })
                    }
                  >
                    {statuses.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {reviewStatusLabel(statusOption)}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <ReviewStatusBadge status={item.review_status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPending ? (
        <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
          Autosaving changes...
        </p>
      ) : null}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-extrabold uppercase text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
