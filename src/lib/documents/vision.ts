import "server-only";

import { runAiJson } from "@/lib/ai/run";

export function isVisionEnabled(): boolean {
  return process.env.VISION_ENABLED !== "false" && Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Vision-based drawing interpretation. Sends a drawing/scanned image to a
 * vision-capable model and returns extracted plain text (title block, notes,
 * legends, schedules, room labels, references). Best-effort — returns null on
 * failure or when disabled, so the caller keeps a placeholder chunk.
 */
export async function interpretDrawing(
  file: { storage_url: string; file_name: string },
  context?: { projectId?: string | null }
): Promise<string | null> {
  if (!isVisionEnabled()) return null;
  try {
    const result = await runAiJson<{ text: string }>({
      task: "drawing_interpretation",
      maxTokens: 2500,
      context: { projectId: context?.projectId ?? null, agentId: "drawing-vision" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are a Quantity Surveyor reading a construction drawing sheet image. " +
                "Extract as readable plain text everything useful for measurement: the drawing " +
                "title and number, revision, discipline, all general notes, legends/keys, any " +
                "schedules (as readable rows), room names/labels, key dimensions and references. " +
                "Do NOT invent anything not visible. Return strict JSON {\"text\": \"...\"}."
            },
            { type: "image_url", image_url: { url: file.storage_url } }
          ]
        }
      ]
    });
    const text = result.data?.text;
    return text && text.trim().length > 0 ? text.trim() : null;
  } catch (error) {
    console.error(`Drawing interpretation failed for ${file.file_name}:`, error);
    return null;
  }
}
