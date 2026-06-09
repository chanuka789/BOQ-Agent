"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardProps = {
  action: (formData: FormData) => void;
};

const standards = [
  {
    value: "POMI",
    label: "POMI",
    description: "Common regional measurement structure for building works."
  },
  {
    value: "NRM2",
    label: "NRM2",
    description: "Detailed measurement rules for building works procurement."
  },
  {
    value: "NRM1",
    label: "NRM1 cost plan",
    description: "Cost planning structure before detailed BOQ production."
  },
  {
    value: "Custom",
    label: "Custom",
    description: "Use when your office or client has a specific rule set."
  }
] as const;

export function NewProjectWizard({ action }: WizardProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    name: "",
    clientName: "",
    projectType: "Commercial fit-out",
    scope: "Architecture + Internal Design"
  });
  const [standard, setStandard] = useState<(typeof standards)[number]["value"]>(
    "POMI"
  );
  const progress = useMemo(() => ((step + 1) / 3) * 100, [step]);

  return (
    <form action={action} className="panel max-w-4xl overflow-hidden">
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="clientName" value={values.clientName} />
      <input type="hidden" name="projectType" value={values.projectType} />
      <input type="hidden" name="scope" value={values.scope} />
      <input type="hidden" name="measurementStandard" value={standard} />

      <div className="border-b border-[var(--border)] bg-white px-6 py-5">
        <div className="mb-3 flex items-center justify-between text-xs font-extrabold text-[var(--muted)]">
          <span>Step {step + 1} of 3</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-2 rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="p-6">
        {step === 0 ? (
          <section className="grid gap-5 md:grid-cols-2">
            <Field
              label="Project name"
              value={values.name}
              onChange={(value) =>
                setValues((current) => ({ ...current, name: value }))
              }
              required
            />
            <Field
              label="Client name"
              value={values.clientName}
              onChange={(value) =>
                setValues((current) => ({ ...current, clientName: value }))
              }
              required
            />
          </section>
        ) : null}

        {step === 1 ? (
          <section className="grid gap-5 md:grid-cols-2">
            <Field
              label="Project type"
              value={values.projectType}
              onChange={(value) =>
                setValues((current) => ({ ...current, projectType: value }))
              }
              required
            />
            <Field
              label="Scope"
              value={values.scope}
              onChange={(value) =>
                setValues((current) => ({ ...current, scope: value }))
              }
              required
            />
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <div className="grid gap-3 md:grid-cols-2">
              {standards.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStandard(item.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    standard === item.value
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--border)] bg-white hover:border-[#b8c7d8]"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-extrabold text-[var(--foreground)]">
                      {item.label}
                    </span>
                    {standard === item.value ? (
                      <Check size={17} aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-[var(--muted)]">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[#f8fafc] px-6 py-4">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back
        </button>

        {step < 2 ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setStep((current) => Math.min(2, current + 1))}
          >
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      <Check size={16} aria-hidden="true" />
      {pending ? "Creating..." : "Create project"}
    </button>
  );
}
