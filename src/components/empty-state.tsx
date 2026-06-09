import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel
}: EmptyStateProps) {
  return (
    <div className="panel grid place-items-center px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link className="btn btn-primary mt-5" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
