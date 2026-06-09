import Link from "next/link";

export function SetupRequired({ error }: { error?: unknown }) {
  const message =
    error instanceof Error ? error.message : "The database is not ready yet.";

  return (
    <div className="panel max-w-3xl p-6">
      <p className="text-sm font-extrabold text-[var(--danger)]">
        Configuration required
      </p>
      <h2 className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
        Connect Clerk and Neon before using the workspace.
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="btn btn-primary" href="/settings">
          View setup checklist
        </Link>
        <span className="btn btn-secondary cursor-default">
          Run database/schema.sql in Neon
        </span>
      </div>
    </div>
  );
}
