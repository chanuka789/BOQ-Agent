// ─────────────────────────────────────────────────────────────────────────────
// Central AI model configuration
// All model IDs, roles, prices and the task→role mapping live here so the model
// strategy can change via environment variables without touching prompts,
// components or API routes.
// ─────────────────────────────────────────────────────────────────────────────

export type ModelRole =
  | "glm_flash" // cheap bulk processing
  | "glm_free" // free / testing only
  | "gemini_flash_lite" // main cheap BOQ model
  | "minimax_m3" // premium BOQ model
  | "qwen_coder"; // optional coding / structured-output model

export type AiTask =
  | "document_classification"
  | "scope_detection"
  | "previous_boq_analysis"
  | "knowledge_base_extraction"
  | "boq_description_generation"
  | "unit_checking"
  | "assumption_generation"
  | "query_rfi_generation"
  | "section_agent_processing"
  | "complex_section_generation"
  | "final_boq_qa"
  | "excel_export_preparation"
  | "drawing_interpretation"
  | "boq_source_validation"
  | "project_understanding"
  | "coverage_check"
  | "testing";

export type QualityMode = "economy" | "balanced" | "premium";

export const QUALITY_MODES: QualityMode[] = ["economy", "balanced", "premium"];

export function isQualityMode(value: unknown): value is QualityMode {
  return value === "economy" || value === "balanced" || value === "premium";
}

export const DEFAULT_QUALITY_MODE: QualityMode = isQualityMode(process.env.AI_DEFAULT_MODE)
  ? process.env.AI_DEFAULT_MODE
  : "balanced";

// Actual OpenRouter model IDs (verified June 2026). Override any with the
// matching AI_MODEL_* env var — e.g. set AI_MODEL_MINIMAX_M3=minimax/minimax-m3
// once MiniMax M3 is published on OpenRouter (currently M2 is the latest).
export const MODEL_IDS: Record<ModelRole, string> = {
  glm_flash: process.env.AI_MODEL_GLM_FLASH || "z-ai/glm-4.7",
  glm_free: process.env.AI_MODEL_GLM_FREE || "z-ai/glm-4.5-air:free",
  gemini_flash_lite:
    process.env.AI_MODEL_GEMINI_FLASH_LITE || "google/gemini-2.5-flash-lite",
  minimax_m3:
    process.env.AI_MODEL_MINIMAX_M3 || process.env.OPENROUTER_MODEL || "minimax/minimax-m2",
  qwen_coder: process.env.AI_MODEL_QWEN_CODER || "qwen/qwen3-coder-flash"
};

export const MODEL_LABELS: Record<ModelRole, string> = {
  glm_flash: "GLM 4.7",
  glm_free: "GLM 4.5 Air (Free)",
  gemini_flash_lite: "Gemini 2.5 Flash-Lite",
  minimax_m3: "MiniMax M2",
  qwen_coder: "Qwen3 Coder Flash"
};

// Approximate USD price per 1K tokens for rough cost estimates (override-friendly).
export const MODEL_PRICES: Record<ModelRole, { input: number; output: number }> = {
  glm_flash: { input: 0.0001, output: 0.0001 },
  glm_free: { input: 0, output: 0 },
  gemini_flash_lite: { input: 0.0001, output: 0.0004 },
  minimax_m3: { input: 0.0003, output: 0.0011 },
  qwen_coder: { input: 0.0002, output: 0.0008 }
};

// Base (balanced) task → role mapping.
const BASE_TASK_ROLE: Record<AiTask, ModelRole> = {
  document_classification: "glm_flash",
  scope_detection: "glm_flash",
  previous_boq_analysis: "gemini_flash_lite",
  knowledge_base_extraction: "gemini_flash_lite",
  boq_description_generation: "gemini_flash_lite",
  unit_checking: "gemini_flash_lite",
  assumption_generation: "gemini_flash_lite",
  query_rfi_generation: "gemini_flash_lite",
  section_agent_processing: "gemini_flash_lite",
  complex_section_generation: "minimax_m3",
  final_boq_qa: "minimax_m3",
  excel_export_preparation: "gemini_flash_lite",
  drawing_interpretation: "gemini_flash_lite", // vision-capable
  boq_source_validation: "gemini_flash_lite",
  project_understanding: "gemini_flash_lite", // lead-coordinator reasoning
  coverage_check: "gemini_flash_lite",
  testing: "glm_free"
};

// Per-quality-mode overrides on top of the base mapping.
const MODE_OVERRIDES: Record<QualityMode, Partial<Record<AiTask, ModelRole>>> = {
  economy: {
    // Cheapest practical models; the premium model is not used.
    complex_section_generation: "gemini_flash_lite",
    final_boq_qa: "gemini_flash_lite"
  },
  balanced: {
    // Cheap models for drafting; reasoning model for coordination + final review.
    project_understanding: "minimax_m3",
    final_boq_qa: "minimax_m3"
  },
  premium: {
    document_classification: "gemini_flash_lite",
    boq_description_generation: "minimax_m3",
    section_agent_processing: "minimax_m3",
    complex_section_generation: "minimax_m3",
    project_understanding: "minimax_m3",
    coverage_check: "minimax_m3",
    final_boq_qa: "minimax_m3"
  }
};

export function roleForTask(task: AiTask, mode: QualityMode): ModelRole {
  return MODE_OVERRIDES[mode][task] ?? BASE_TASK_ROLE[task];
}

export function modelIdForRole(role: ModelRole): string {
  return MODEL_IDS[role];
}

export function roleForModelId(modelId: string): ModelRole | null {
  const entry = (Object.entries(MODEL_IDS) as Array<[ModelRole, string]>).find(
    ([, id]) => id === modelId
  );
  return entry ? entry[0] : null;
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const role = roleForModelId(modelId);
  if (!role) return 0;
  const price = MODEL_PRICES[role];
  return (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
}
