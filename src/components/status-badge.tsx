import type {
  JobStatus,
  ProjectStatus,
  QueryStatus,
  ReviewStatus
} from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { reviewStatusLabel } from "@/lib/format";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-[#d8e0ea] bg-[#f5f7fa] text-[#475569]",
  success: "border-[#bde7d3] bg-[var(--success-soft)] text-[var(--success)]",
  warning: "border-[#f4d48c] bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "border-[#f7beb8] bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[#c7ddf2] bg-[var(--primary-soft)] text-[var(--primary)]"
};

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const tone: BadgeTone =
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "needs_review"
          ? "warning"
          : status === "revised"
            ? "info"
            : "neutral";

  return <Badge tone={tone}>{reviewStatusLabel(status)}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const tone: BadgeTone =
    status === "ready_for_review" || status === "exported"
      ? "success"
      : status === "processing"
        ? "warning"
        : status === "ready_for_generation"
          ? "info"
          : "neutral";

  return (
    <Badge tone={tone}>
      {status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")}
    </Badge>
  );
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const tone: BadgeTone =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "running"
          ? "warning"
          : "info";

  return <Badge tone={tone}>{status}</Badge>;
}

export function QueryStatusBadge({ status }: { status: QueryStatus }) {
  const tone: BadgeTone =
    status === "closed" ? "success" : status === "answered" ? "info" : "warning";

  return <Badge tone={tone}>{status}</Badge>;
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone: BadgeTone = value >= 0.82 ? "success" : value >= 0.68 ? "warning" : "danger";

  return <Badge tone={tone}>{Math.round(value * 100)}%</Badge>;
}
