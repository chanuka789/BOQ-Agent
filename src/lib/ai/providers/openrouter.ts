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
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as T;
    }

    throw error;
  }
}
