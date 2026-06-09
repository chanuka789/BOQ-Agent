import "server-only";

import { DEFAULT_QUALITY_MODE, estimateCost, type AiTask, type QualityMode } from "@/lib/ai/model-config";
import { modelChain } from "@/lib/ai/model-router";
import { callOpenRouter, parseStrictJson, type AiMessage } from "@/lib/ai/openrouter";
import { logAiUsage } from "@/lib/db/ai-usage";

export type AiRunContext = {
  projectId?: string | null;
  generationId?: string | null;
  agentId?: string | null;
};

export type AiJsonResult<T> = {
  data: T;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  attempts: number;
};

/**
 * Run a JSON completion for a task. The model router picks the primary model for
 * the task + quality mode; on failure it falls back down the chain. Every attempt
 * (success or failure) is logged to ai_model_usage_logs for cost tracking.
 */
export async function runAiJson<T>({
  task,
  mode = DEFAULT_QUALITY_MODE,
  messages,
  temperature = 0.1,
  maxTokens = 4000,
  context
}: {
  task: AiTask;
  mode?: QualityMode;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  context?: AiRunContext;
}): Promise<AiJsonResult<T>> {
  const chain = modelChain(task, mode);
  if (chain.length === 0) {
    throw new Error(`No models configured for task "${task}".`);
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < chain.length; attempt++) {
    const model = chain[attempt];
    const startedAt = Date.now();
    try {
      const result = await callOpenRouter({ model, messages, temperature, maxTokens });
      const data = parseStrictJson<T>(result.content);

      await logAiUsage({
        projectId: context?.projectId,
        generationId: context?.generationId,
        agentId: context?.agentId,
        taskType: task,
        modelName: result.model,
        qualityMode: mode,
        attempt: attempt + 1,
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        estimatedCost: estimateCost(model, result.usage.promptTokens, result.usage.completionTokens),
        status: "success",
        durationMs: Date.now() - startedAt
      });

      return { data, model: result.model, usage: result.usage, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`AI task "${task}" failed on ${model} (attempt ${attempt + 1}):`, message);

      await logAiUsage({
        projectId: context?.projectId,
        generationId: context?.generationId,
        agentId: context?.agentId,
        taskType: task,
        modelName: model,
        qualityMode: mode,
        attempt: attempt + 1,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        status: "failed",
        errorMessage: message,
        durationMs: Date.now() - startedAt
      });
      // try the next model in the chain
    }
  }

  throw new Error(
    `All models failed for task "${task}": ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
