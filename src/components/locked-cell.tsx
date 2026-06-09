import { Lock } from "lucide-react";

export function LockedCell() {
  return (
    <span className="locked-cell inline-flex items-center gap-1.5">
      <Lock size={12} aria-hidden="true" />
      blank
    </span>
  );
}
