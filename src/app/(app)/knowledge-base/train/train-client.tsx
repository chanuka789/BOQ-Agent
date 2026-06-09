"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type UploadState = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "complete" | "error";
  message?: string;
};

export function TrainClient() {
  const [standard, setStandard] = useState("");
  const [states, setStates] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      setStates((s) => [...s, { id, name: file.name, progress: 0, status: "uploading" }]);
      try {
        await upload(`previous-boqs/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/previous-boq/upload",
          clientPayload: JSON.stringify({ fileName: file.name, measurementStandard: standard || undefined }),
          onUploadProgress: ({ percentage }) =>
            setStates((s) => s.map((x) => (x.id === id ? { ...x, progress: percentage } : x)))
        });
        setStates((s) =>
          s.map((x) =>
            x.id === id
              ? { ...x, progress: 100, status: "complete", message: "Uploaded — analysing app-wide knowledge…" }
              : x
          )
        );
        setTimeout(() => router.refresh(), 1500);
      } catch (error) {
        setStates((s) =>
          s.map((x) =>
            x.id === id
              ? { ...x, status: "error", message: error instanceof Error ? error.message : "Upload failed." }
              : x
          )
        );
      }
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-base font-extrabold text-[var(--foreground)]">
        Upload previous BOQs (app-wide)
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        These are not tied to a project. The analysed knowledge is reused by the
        agents on every project.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-extrabold uppercase text-[var(--muted)]">
          Measurement method (optional)
        </label>
        <select
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          className="select max-w-[200px]"
        >
          <option value="">Any / detect</option>
          <option value="POMI">POMI</option>
          <option value="NRM2">NRM2</option>
          <option value="NRM1">NRM1</option>
          <option value="Custom">Custom</option>
        </select>
      </div>

      <button
        type="button"
        className="mt-4 grid min-h-40 w-full place-items-center rounded-lg border border-dashed border-[#b8c7d8] bg-[#f8fafc] px-6 py-8 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
            <UploadCloud size={23} aria-hidden="true" />
          </span>
          <span className="mt-4 text-sm font-extrabold text-[var(--foreground)]">
            Drop previous BOQ files or browse
          </span>
          <span className="mt-2 text-xs text-[var(--muted)]">Excel or PDF bills</span>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.xlsx,.xls,.xlsm"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {states.length > 0 ? (
        <div className="mt-4 space-y-3">
          {states.map((state) => (
            <div key={state.id} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-semibold text-[var(--foreground)]">{state.name}</p>
                <span className="text-xs font-extrabold text-[var(--muted)]">
                  {Math.round(state.progress)}%
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--surface-muted)]">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    state.status === "error" ? "bg-[var(--danger)]" : "bg-[var(--primary)]"
                  )}
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              {state.message ? (
                <p className="mt-2 text-xs text-[var(--muted)]">{state.message}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
