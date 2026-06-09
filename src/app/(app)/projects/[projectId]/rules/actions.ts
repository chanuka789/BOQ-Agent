"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { createRule, deleteRule } from "@/lib/db/rules";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

const createRuleSchema = z.object({
  projectId: z.string().uuid(),
  measurementStandard: z.enum(["POMI", "NRM2", "NRM1", "Custom"]),
  scope: z.string().min(2),
  trade: z.string().min(2),
  itemType: z.string().min(2),
  unit: z.string().trim().min(1),
  descriptionRule: z.string().min(8),
  inclusions: z.string().optional(),
  exclusions: z.string().optional()
});

export async function createRuleAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const parsed = createRuleSchema.parse({
    projectId: formData.get("projectId"),
    measurementStandard: formData.get("measurementStandard"),
    scope: formData.get("scope"),
    trade: formData.get("trade"),
    itemType: formData.get("itemType"),
    unit: formData.get("unit"),
    descriptionRule: formData.get("descriptionRule"),
    inclusions: formData.get("inclusions")?.toString(),
    exclusions: formData.get("exclusions")?.toString()
  });

  await assertProjectAccess(parsed.projectId, user.id);
  await createRule(parsed);
  await addActivityLog({
    projectId: parsed.projectId,
    userId: user.id,
    action: "rule.created",
    details: {
      trade: parsed.trade,
      itemType: parsed.itemType,
      unit: parsed.unit
    }
  });

  revalidatePath(`/projects/${parsed.projectId}/rules`);
}

export async function deleteRuleAction(formData: FormData) {
  const user = await requireCurrentAppUser();
  const projectId = z.string().uuid().parse(formData.get("projectId"));
  const ruleId = z.string().uuid().parse(formData.get("ruleId"));

  await assertProjectAccess(projectId, user.id);
  await deleteRule(ruleId);
  await addActivityLog({
    projectId,
    userId: user.id,
    action: "rule.deleted",
    details: { ruleId }
  });

  revalidatePath(`/projects/${projectId}/rules`);
}
