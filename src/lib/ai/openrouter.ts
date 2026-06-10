import "server-only";

// Low-level OpenRouter API call. Server-side only — the API key is never sent to
// the browser. Higher-level routing/fallback/logging lives in run.ts.

export type AiMessage = {
  role: "system" | "user" | "assistant";
  // string for text-only; array for multimodal (vision) content blocks.
  content: unknown;
};

export type OpenRouterResult = {
  content: string;
  reasoning: string | null;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
};

type RawResponse = {
  choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: { message?: string };
};

export async function callOpenRouter({
  model,
  messages,
  temperature = 0.1,
  maxTokens = 4000,
  reasoning = false,
  signal
}: {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  reasoning?: boolean;
  signal?: AbortSignal;
}): Promise<OpenRouterResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  // Guard against a hung upstream call stalling the whole generation.
  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000);
  const requestSignal = signal ?? AbortSignal.timeout(timeoutMs);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: requestSignal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "AI BOQ Agent"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      // Ask reasoning-capable models to expose their chain-of-thought (ignored
      // by models that don't support it).
      ...(reasoning ? { reasoning: { enabled: true } } : {})
    })
  });

  const json = (await response.json()) as RawResponse;

  if (!response.ok) {
    throw new Error(json.error?.message ?? `OpenRouter request failed (${response.status})`);
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response");
  }

  return {
    content,
    reasoning: json.choices?.[0]?.message?.reasoning ?? null,
    model: json.model ?? model,
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0
    }
  };
}

/** Robust JSON parse that recovers from markdown fences and truncated output. */
export function parseStrictJson<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    /* fall through */
  }

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

  return JSON.parse(repairTruncatedJson(bounded)) as T;
}

function repairTruncatedJson(raw: string): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastItemClose = -1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 2 && ch === "}") lastItemClose = i + 1;
    }
  }

  if (lastItemClose < 0) return raw;
  return raw.slice(0, lastItemClose) + "]}";
}
