import "server-only";

// Optional embeddings provider for semantic search / RAG retrieval. Off unless
// EMBEDDINGS_ENABLED=true. The document_chunks.embedding column is vector(1536),
// so the model must output 1536-dim vectors (e.g. openai/text-embedding-3-small).
// If disabled or it errors, callers fall back to keyword ranking.

export const EMBEDDING_DIM = 1536;

const MODEL = process.env.EMBEDDINGS_MODEL || "openai/text-embedding-3-small";
const BASE_URL =
  process.env.EMBEDDINGS_BASE_URL ||
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1";
const API_KEY = process.env.EMBEDDINGS_API_KEY || process.env.OPENROUTER_API_KEY;

export function isEmbeddingsEnabled(): boolean {
  return process.env.EMBEDDINGS_ENABLED === "true" && Boolean(API_KEY);
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!isEmbeddingsEnabled() || texts.length === 0) return null;
  try {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODEL, input: texts })
    });
    if (!res.ok) {
      console.error("Embeddings request failed:", await res.text().catch(() => res.status));
      return null;
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const vectors = (json.data ?? []).map((d) => d.embedding);
    return vectors.length === texts.length ? vectors : null;
  } catch (error) {
    console.error("Embeddings error:", error);
    return null;
  }
}

export async function embedOne(text: string): Promise<number[] | null> {
  const result = await embedTexts([text.slice(0, 8000)]);
  return result ? result[0] : null;
}
