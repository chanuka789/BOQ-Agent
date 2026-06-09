import type {
  AIProvider,
  JsonCompletionRequest,
  JsonCompletionResult
} from "@/lib/ai/providers/types";

type OpenRouterChoice = {
  message?: {
    content?: string;
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: {
    message?: string;
  };
};

export class OpenRouterProvider implements AIProvider {
  readonly name = "OpenRouter";
  readonly model: string;

  constructor(model = process.env.OPENROUTER_MODEL ?? "minimax/minimax-m3") {
    this.model = model;
  }

  async completeJson<T>({
    messages,
    temperature = 0.1,
    maxTokens = 4000
  }: JsonCompletionRequest): Promise<JsonCompletionResult<T>> {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "AI BOQ Agent"
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" }
      })
    });

    const json = (await response.json()) as OpenRouterResponse;

    if (!response.ok) {
      throw new Error(json.error?.message ?? "OpenRouter request failed");
    }

    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenRouter returned an empty response");
    }

    return {
      data: parseStrictJson<T>(content),
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens
      },
      model: json.model ?? this.model
    };
  }
}

function parseStrictJson<T>(content: string): T {
  // 1. Clean try
  try {
    return JSON.parse(content) as T;
  } catch {
    /* fall through */
  }

  // 2. Strip non-JSON prefix/suffix (e.g. markdown code fences)
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  const bounded =
    firstBrace >= 0 && lastBrace > firstBrace
      ? content.slice(firstBrace, lastBrace + 1)
      : content;

  try {
    return JSON.parse(bounded) as T;
  } catch {
    /* fall through */
  }

  // 3. The response was likely truncated at the max_tokens limit.
  //    Recover all complete items that were generated before the cut-off.
  const repaired = repairTruncatedJson(bounded);
  return JSON.parse(repaired) as T;
}

/**
 * Recovers JSON truncated mid-array by finding the last complete object
 * that was closed at array depth (depth 3→2 in a structure like
 * { "boq_items": [ { ...item... } ] }) and closing the open containers.
 */
function repairTruncatedJson(raw: string): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastItemClose = -1; // char index after the last } that moved depth 3→2

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      // depth 2 = we just closed an object that was at depth 3,
      // meaning a direct child of one of the root arrays
      if (depth === 2 && ch === "}") lastItemClose = i + 1;
    }
  }

  if (lastItemClose < 0) return raw; // nothing recoverable

  // Slice up to (and including) the last complete item,
  // then close the open array and root object.
  return raw.slice(0, lastItemClose) + "]}";
}
