import { ShieldAlert } from "lucide-react";

export function ReviewBanner() {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#f4d48c] bg-[var(--warning-soft)] px-4 py-3 text-[var(--warning)]">
      <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div>
        <p className="text-sm font-extrabold">
          AI-generated draft - review required before pricing or tender
        </p>
        <p className="mt-1 text-xs leading-5">
          The agent drafts descriptions and units only. Quantity, rate, and
          amount remain locked and blank for the QS to complete.
        </p>
      </div>
    </div>
  );
}
