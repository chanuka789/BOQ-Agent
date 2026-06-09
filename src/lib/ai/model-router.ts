// ─────────────────────────────────────────────────────────────────────────────
// Model router
// Chooses the model chain (primary + fallbacks) for a task and quality mode.
// All callers go through this — agents and tasks never pick a model directly.
// ─────────────────────────────────────────────────────────────────────────────

import {
  modelIdForRole,
  roleForTask,
  type AiTask,
  type ModelRole,
  type QualityMode
} from "@/lib/ai/model-config";

// Production fallback order (excludes the free testing model).
const FALLBACK_ROLES: ModelRole[] = ["gemini_flash_lite", "minimax_m3", "glm_flash"];

/**
 * Returns an ordered list of OpenRouter model IDs to try for a task: the routed
 * primary first, then production fallbacks. If the primary model fails, the
 * caller retries down this chain before failing the task.
 */
export function modelChain(task: AiTask, mode: QualityMode): string[] {
  const primaryRole = roleForTask(task, mode);
  const roles: ModelRole[] = [primaryRole];

  // Testing tasks stay on the free model only (no paid fallback).
  if (primaryRole !== "glm_free") {
    for (const role of FALLBACK_ROLES) {
      if (!roles.includes(role)) roles.push(role);
    }
  }

  const ids: string[] = [];
  for (const role of roles) {
    const id = modelIdForRole(role);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The primary (first-choice) model id for display before a call runs. */
export function primaryModel(task: AiTask, mode: QualityMode): string {
  return modelIdForRole(roleForTask(task, mode));
}
