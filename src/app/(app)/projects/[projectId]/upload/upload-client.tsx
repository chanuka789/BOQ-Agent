"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileSpreadsheet, FileText, UploadCloud } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type UploadRole = "source_document" | "boq_template";

type UploadState = {
  id: string;
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
      const uploadId = crypto.randomUUID();
      setStates((current) => [
        ...current,
        {
          id: uploadId,
          name: file.name,
          role,
          progress: 0,
          status: "uploading"
        }
      ]);

      try {
        await assertUploadReady(projectId);

        await upload(`projects/${projectId}/${role}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({
            projectId,
            fileRole: role,
            fileType: role,
            sizeBytes: file.size
          }),
          onUploadProgress: ({ percentage }) => {
            setStates((current) =>
              current.map((item) =>
                item.id === uploadId ? { ...item, progress: percentage } : item
              )
            );
          }
        });

        setStates((current) =>
          current.map((item) =>
            item.id === uploadId
              ? {
                  ...item,
                  progress: 100,
                  status: "complete",
                  message: "Upload complete. Indexing for the AI agents…"
                }
              : item
          )
        );

        // Pre-process into the structured knowledge layer now, so generation
        // starts instantly later. Delayed so the blob callback can record the
        // file first; fire-and-forget (generation re-checks as a fallback).
        if (role === "source_document") {
          setTimeout(() => {
            void fetch("/api/documents/process", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId })
            }).catch(() => {});
          }, 4000);
        }
      } catch (error) {
        setStates((current) =>
          current.map((item) =>
            item.id === uploadId
              ? {
                  ...item,
                  status: "error",
                  message: getUploadErrorMessage(error)
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
            {states.map((state) => (
              <div key={state.id} className="rounded-lg border border-[var(--border)] p-3">
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

async function assertUploadReady(projectId: string) {
  const response = await fetch(
    `/api/upload?projectId=${encodeURIComponent(projectId)}`,
    {
      cache: "no-store"
    }
  );

  if (response.ok) {
    return;
  }

  let message = "Upload service is not ready.";

  try {
    const data = (await response.json()) as { error?: string };
    message = data.error ?? message;
  } catch {
    // Keep the generic readiness message if the response is not JSON.
  }

  throw new Error(message);
}

function getUploadErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Upload failed. Please try again.";

  if (message.includes("Failed to retrieve the client token")) {
    return "Vercel Blob could not create an upload token. Check BLOB_READ_WRITE_TOKEN in the Vercel Production environment, redeploy, then retry.";
  }

  return message;
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
