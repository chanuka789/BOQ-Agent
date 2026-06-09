import "server-only";

import { runAiJson } from "@/lib/ai/run";
import { createRule } from "@/lib/db/rules";
import type { AppKnowledgeRow, MeasurementStandard } from "@/lib/db/types";

type SynthRule = {
  section_code?: string;
  trade: string;
  item_type?: string;
  unit: string;
  description_rule: string;
  inclusions?: string;
  exclusions?: string;
};

const STANDARDS: MeasurementStandard[] = ["POMI", "NRM2", "NRM1", "Custom"];
const VALID_UNITS = ["nr", "m", "m2", "m3", "kg", "t", "item", "sum", "no", "%"];

/**
 * Convert an approved app-wide knowledge record into reusable BOQ rules and store
 * them in the app-wide rule library (boq_rules). This is the link between the
 * Knowledge base and the BOQ rule library: approving knowledge seeds rules that
 * the section agents then use to confirm units and description structure.
 */
export async function synthesizeAndStoreRules(
  row: AppKnowledgeRow
): Promise<{ created: number; standard: MeasurementStandard }> {
  const samples = (row.sample_items ?? [])
    .slice(0, 20)
    .map((s) => `- ${s.description ?? ""} [${s.unit ?? ""}]`)
    .join("\n");

  const result = await runAiJson<{ measurement_standard: string; rules: SynthRule[] }>({
    task: "unit_checking",
    maxTokens: 3000,
    messages: [
      {
        role: "system",
        content:
          "You convert learned Quantity Surveying BOQ knowledge into reusable BOQ rules for a rule database. " +
          'Return strict JSON {"measurement_standard":"POMI|NRM2|NRM1|Custom","rules":[{"section_code","trade","item_type","unit","description_rule","inclusions","exclusions"}]}. ' +
          "Units must be valid QS units (nr, m, m2, m3, kg, t, item, sum). Never include quantities, rates or amounts. " +
          "Use section codes appropriate to the standard (POMI letters GP/A–R, NRM2 work-section numbers 1–41) where evident. " +
          "Produce one rule per distinct measured work item you can infer (max 25). Keep description_rule a concise instruction on how to describe that item."
      },
      {
        role: "user",
        content:
          `Scope: ${row.scope}\n` +
          `Declared measurement standard: ${row.measurement_standard ?? "unknown — infer from the patterns"}\n` +
          `Section code (if any): ${row.section_code ?? "none"}\n` +
          `Description patterns: ${row.description_patterns ?? ""}\n` +
          `Item wording: ${row.item_wording_patterns ?? ""}\n` +
          `Unit usage: ${row.unit_usage_patterns ?? ""}\n` +
          `Inclusions: ${row.inclusions ?? ""}\n` +
          `Exclusions: ${row.exclusions ?? ""}\n` +
          `Example items:\n${samples}\n\nReturn the rules JSON.`
      }
    ]
  });

  const inferred = result.data.measurement_standard as MeasurementStandard;
  const standard: MeasurementStandard = STANDARDS.includes(inferred)
    ? inferred
    : ((row.measurement_standard as MeasurementStandard) &&
        STANDARDS.includes(row.measurement_standard as MeasurementStandard)
        ? (row.measurement_standard as MeasurementStandard)
        : "POMI");

  let created = 0;
  for (const rule of result.data.rules ?? []) {
    const unit = (rule.unit ?? "").trim().toLowerCase();
    if (!rule.trade || !rule.description_rule || !unit) continue;
    if (!VALID_UNITS.includes(unit)) continue;

    await createRule({
      measurementStandard: standard,
      sectionCode: rule.section_code || row.section_code || null,
      scope: row.scope,
      trade: rule.trade.trim(),
      itemType: (rule.item_type || rule.trade).trim(),
      unit,
      descriptionRule: rule.description_rule.trim(),
      inclusions: rule.inclusions ?? row.inclusions ?? null,
      exclusions: rule.exclusions ?? row.exclusions ?? null
    }).catch((error) => console.error("createRule from knowledge failed:", error));
    created += 1;
  }

  return { created, standard };
}
