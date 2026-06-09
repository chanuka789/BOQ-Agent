"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createRule, deleteRule } from "@/lib/db/rules";
import { requireCurrentAppUser } from "@/lib/db/users";

const createRuleSchema = z.object({
  measurementStandard: z.enum(["POMI", "NRM2", "NRM1", "Custom"]),
  sectionCode: z.string().trim().optional(),
  scope: z.string().trim().min(2),
  trade: z.string().trim().min(2),
  itemType: z.string().trim().min(2),
  unit: z.string().trim().min(1),
  descriptionRule: z.string().trim().min(8),
  inclusions: z.string().trim().optional(),
  exclusions: z.string().trim().optional()
});

export async function createRuleAction(formData: FormData) {
  await requireCurrentAppUser();
  const parsed = createRuleSchema.parse({
    measurementStandard: formData.get("measurementStandard"),
    sectionCode: formData.get("sectionCode")?.toString() || undefined,
    scope: formData.get("scope"),
    trade: formData.get("trade"),
    itemType: formData.get("itemType"),
    unit: formData.get("unit"),
    descriptionRule: formData.get("descriptionRule"),
    inclusions: formData.get("inclusions")?.toString() || undefined,
    exclusions: formData.get("exclusions")?.toString() || undefined
  });

  await createRule({
    ...parsed,
    sectionCode: parsed.sectionCode ?? null
  });

  revalidatePath("/rules");
}

export async function deleteRuleAction(formData: FormData) {
  await requireCurrentAppUser();
  const ruleId = z.string().uuid().parse(formData.get("ruleId"));
  await deleteRule(ruleId);
  revalidatePath("/rules");
}
