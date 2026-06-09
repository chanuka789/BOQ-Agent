"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addActivityLog } from "@/lib/db/activity";
import { updateBoqItemFields } from "@/lib/db/boq";
import { assertProjectAccess } from "@/lib/db/projects";
import { requireCurrentAppUser } from "@/lib/db/users";

const updateItemSchema = z.object({
  projectId: z.string().uuid(),
  itemId: z.string().uuid(),
  description: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  reviewStatus: z
    .enum(["draft", "needs_review", "approved", "rejected", "revised"])
    .optional()
});

export async function updateBoqItemAction(input: z.infer<typeof updateItemSchema>) {
  const user = await requireCurrentAppUser();
  const parsed = updateItemSchema.parse(input);

  await assertProjectAccess(parsed.projectId, user.id);
  await updateBoqItemFields({
    itemId: parsed.itemId,
    userId: user.id,
    description: parsed.description,
    unit: parsed.unit,
    reviewStatus: parsed.reviewStatus
  });
  await addActivityLog({
    projectId: parsed.projectId,
    userId: user.id,
    action: "boq_item.updated",
    details: {
      itemId: parsed.itemId,
      fields: Object.keys(parsed).filter(
        (key) => !["projectId", "itemId"].includes(key)
      )
    }
  });

  revalidatePath(`/projects/${parsed.projectId}/boq-review`);
}
