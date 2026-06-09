import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";

let provider: OpenRouterProvider | null = null;

export function getAIProvider() {
  if (!provider) {
    provider = new OpenRouterProvider();
  }

  return provider;
}
