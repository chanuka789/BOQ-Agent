"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveScope } from "@/lib/agents/catalog";
import {
  deleteAppKnowledge,
  setAppKnowledgeStatus,
  updateAppKnowledge
} from "@/lib/db/app-knowledge";
import { requireCurrentAppUser } from "@/lib/db/users";

const idSchema = z.string().uuid();

function text(value: FormDataEntryValue | null): string | null {
  const trimmed = (value as string | null)?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export async function approveKnowledgeAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = idSchema.parse(formData.get("id"));
  await setAppKnowledgeStatus(id, "approved");
  revalidatePath("/knowledge-base");
}

export async function disableKnowledgeAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = idSchema.parse(formData.get("id"));
  await setAppKnowledgeStatus(id, "disabled");
  revalidatePath("/knowledge-base");
}

export async function activateKnowledgeAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = idSchema.parse(formData.get("id"));
  await setAppKnowledgeStatus(id, "active");
  revalidatePath("/knowledge-base");
}

export async function deleteKnowledgeAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = idSchema.parse(formData.get("id"));
  await deleteAppKnowledge(id);
  revalidatePath("/knowledge-base");
}

export async function updateKnowledgeAction(formData: FormData) {
  await requireCurrentAppUser();
  const id = idSchema.parse(formData.get("id"));
  const scope = (formData.get("scope") as string | null)?.trim() || "General";

  await updateAppKnowledge(id, {
    scope,
    // Keep the agent id consistent with the (possibly edited) scope.
    agentId: resolveScope(scope).agentId,
    measurementStandard: text(formData.get("measurement_standard")),
    sectionCode: text(formData.get("section_code")),
    description_patterns: text(formData.get("description_patterns")),
    item_wording_patterns: text(formData.get("item_wording_patterns")),
    trade_section_structure: text(formData.get("trade_section_structure")),
    heading_structure: text(formData.get("heading_structure")),
    numbering_style: text(formData.get("numbering_style")),
    unit_usage_patterns: text(formData.get("unit_usage_patterns")),
    measurement_standard_usage: text(formData.get("measurement_standard_usage")),
    scope_description_patterns: text(formData.get("scope_description_patterns")),
    inclusions: text(formData.get("inclusions")),
    exclusions: text(formData.get("exclusions")),
    summary_structure: text(formData.get("summary_structure")),
    collection_structure: text(formData.get("collection_structure")),
    cover_page_style: text(formData.get("cover_page_style")),
    excel_formatting_style: text(formData.get("excel_formatting_style")),
    column_structure: text(formData.get("column_structure")),
    client_company_style: text(formData.get("client_company_style"))
  });

  revalidatePath("/knowledge-base");
  redirect("/knowledge-base");
}
