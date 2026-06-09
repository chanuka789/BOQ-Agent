"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileSpreadsheet, FileText, UploadCloud } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type UploadRole = "source_document" | "boq_template";

type UploadState = {
  name: string;
  role: UploadRole;
  progress: number;
  status: "ready" | "uploading" | "complete" | "error";
  message?: string;
};

export function UploadClient({ projectId }: { projectId: string }) {
  const [role, setRole] = useState<UploadRole>("source_document");
  const [states, setStates] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const selected = Array.from(files);

    for (const file of selected) {
      const index = states.length;
      setStates((current) => [
        ...current,
        {
          name: file.name,
          role,
          progress: 0,
          status: "uploading"
        }
      ]);

      try {
        await upload(`projects/${projectId}/${role}/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          multipart: file.size > 20 * 1024 * 1024,
          clientPayload: JSON.stringify({
            projectId,
            fileRole: role,
            fileType: role,
            sizeBytes: file.size
          }),
          onUploadProgress: ({ percentage }) => {
            setStates((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, progress: percentage } : item
              )
            );
          }
        });

        setStates((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  progress: 100,
                  status: "complete",
                  message: "Upload complete. Metadata will appear after Vercel confirms the callback."
                }
              : item
          )
        );
      } catch (error) {
        setStates((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  status: "error",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Upload failed. Please try again."
                }
              : item
          )
        );
      }
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[var(--border)] p-5">
        <h2 className="text-base font-extrabold text-[var(--foreground)]">
          Add files
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Upload documents directly to Vercel Blob. Choose BOQ template for the
          supplied Excel bill formats.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <RoleButton
            active={role === "source_document"}
            icon={FileText}
            label="Source document"
            description="Drawings, specifications, schedules, PDFs, images"
            onClick={() => setRole("source_document")}
          />
          <RoleButton
            active={role === "boq_template"}
            icon={FileSpreadsheet}
            label="BOQ template"
            description="Excel bill format used for descriptions and export"
            onClick={() => setRole("boq_template")}
          />
        </div>

        <button
          type="button"
          className="grid min-h-48 w-full place-items-center rounded-lg border border-dashed border-[#b8c7d8] bg-[#f8fafc] px-6 py-8 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <span className="grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
              <UploadCloud size={23} aria-hidden="true" />
            </span>
            <span className="mt-4 text-sm font-extrabold text-[var(--foreground)]">
              Drop files here or browse
            </span>
            <span className="mt-2 text-xs text-[var(--muted)]">
              PDF, Excel, PNG, JPG · up to {formatBytes(500 * 1024 * 1024)}
            </span>
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.xlsx,.xls,.xlsm,.png,.jpg,.jpeg"
          onChange={(event) => void handleFiles(event.target.files)}
        />

        {states.length ? (
          <div className="space-y-3">
            {states.map((state, index) => (
              <div key={`${state.name}-${index}`} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--foreground)]">
                      {state.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {state.role.replace("_", " ")} · {state.status}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-[var(--muted)]">
                    {Math.round(state.progress)}%
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--surface-muted)]">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      state.status === "error"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--primary)]"
                    )}
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
                {state.message ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {state.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RoleButton({
  active,
  icon: Icon,
  label,
  description,
  onClick
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition",
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
          : "border-[var(--border)] bg-white hover:border-[#b8c7d8]"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-extrabold text-[var(--foreground)]">
        <Icon size={17} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
        {description}
      </span>
    </button>
  );
}
