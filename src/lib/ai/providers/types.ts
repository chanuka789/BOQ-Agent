export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type JsonCompletionRequest = {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type JsonCompletionResult<T> = {
  data: T;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model: string;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  completeJson<T>(request: JsonCompletionRequest): Promise<JsonCompletionResult<T>>;
}
