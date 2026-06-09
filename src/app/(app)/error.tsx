"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-12">
      <div className="panel max-w-xl p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)]">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-[var(--foreground)]">
          This workspace page could not load
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          A server-side configuration or database step failed. Retry once, then
          check Vercel runtime logs for this error digest.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--muted)]">
            Digest: {error.digest}
          </p>
        ) : null}
        <div className="mt-4 p-4 border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] text-left rounded-lg text-xs font-mono overflow-auto max-h-60">
          <p className="font-extrabold">{error.name}: {error.message}</p>
          {error.stack ? <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre> : null}
        </div>
        <button className="btn btn-primary mt-5" type="button" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />
          Reload page
        </button>
      </div>
    </div>
  );
}
