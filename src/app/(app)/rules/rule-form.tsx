"use client";

import { useState } from "react";
import { createRuleAction } from "./actions";

type SectionOption = { code: string; title: string };

export function RuleForm({
  sections,
  defaultStandard
}: {
  sections: Record<string, SectionOption[]>;
  defaultStandard: string;
}) {
  const [standard, setStandard] = useState(defaultStandard);
  const sectionOptions = sections[standard] ?? [];

  return (
    <form action={createRuleAction} className="space-y-4">
      <label className="block">
        <span className="label">Measurement method</span>
        <select
          className="select"
          name="measurementStandard"
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
        >
          <option value="POMI">POMI</option>
          <option value="NRM2">NRM2</option>
          <option value="NRM1">NRM1</option>
          <option value="Custom">Custom</option>
        </select>
      </label>

      <label className="block">
        <span className="label">Section</span>
        <select className="select" name="sectionCode" defaultValue="">
          <option value="">General (applies to all sections)</option>
          {sectionOptions.map((s) => (
            <option key={s.code} value={s.code}>
              {standard} {s.code} — {s.title}
            </option>
          ))}
        </select>
      </label>

      <Field label="Scope" name="scope" placeholder="Architectural, Internal Design, Structural…" />
      <Field label="Trade / work item" name="trade" placeholder="Doors" />
      <Field label="Item type" name="itemType" placeholder="Door set" />
      <Field label="Unit" name="unit" placeholder="nr, item, m2, m, kg, t" />

      <label className="block">
        <span className="label">Description rule</span>
        <textarea
          className="textarea"
          name="descriptionRule"
          placeholder="Describe size, type, material, reference, finish, rating, and location where applicable."
          required
        />
      </label>

      <Field label="Inclusions" name="inclusions" required={false} />
      <Field label="Exclusions" name="exclusions" required={false} />

      <button className="btn btn-primary w-full" type="submit">
        Add rule
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = true
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" name={name} placeholder={placeholder} required={required} />
    </label>
  );
}
