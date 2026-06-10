import "server-only";

import { runAiJson } from "@/lib/ai/run";
import type { ScheduleType } from "@/lib/db/types";

const SCHEDULE_FIELDS: Record<ScheduleType, string[]> = {
  door: [
    "door_ref",
    "door_type",
    "structural_opening_size",
    "fire_rating",
    "material",
    "finish",
    "ironmongery",
    "location"
  ],
  window: ["window_ref", "window_type", "size", "glazing", "frame_material", "finish", "location"],
  finishes: ["room_ref", "floor_finish", "wall_finish", "ceiling_finish", "skirting"],
  sanitary: ["ref", "item", "type", "material", "location"],
  lighting: ["ref", "fitting_type", "lamp", "mounting", "location"],
  equipment: ["ref", "item", "type", "specification", "location"],
  room_data: ["room_ref", "room_name", "area", "occupancy", "finishes", "services"],
  other: ["ref", "description", "location"]
};

export type ParsedSchedule = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

/**
 * Convert raw schedule text/CSV into structured rows via a cheap model. Bounded
 * input keeps the cost low; returns an empty result on failure (best-effort).
 */
export async function parseSchedule(
  scheduleType: ScheduleType,
  content: string,
  context?: { projectId?: string | null }
): Promise<ParsedSchedule> {
  const fields = SCHEDULE_FIELDS[scheduleType] ?? SCHEDULE_FIELDS.other;
  try {
    const result = await runAiJson<{ rows: Array<Record<string, unknown>> }>({
      task: "document_classification",
      maxTokens: 3000,
      context: { projectId: context?.projectId ?? null, agentId: "schedule-parser" },
      messages: [
        {
          role: "system",
          content:
            `You extract a ${scheduleType} schedule from a construction document into structured JSON. ` +
            `Return strict JSON {"rows":[{...}]} where each row object uses these fields: ${fields.join(", ")}. ` +
            `One object per real schedule row. Use "" for missing fields. Do NOT invent rows that are not present. ` +
            `Do NOT include quantities, rates or prices.`
        },
        { role: "user", content: content.slice(0, 12000) }
      ]
    });
    const rows = Array.isArray(result.data.rows) ? result.data.rows.slice(0, 300) : [];
    return { columns: fields, rows };
  } catch (error) {
    console.error(`Schedule parse failed (${scheduleType}):`, error);
    return { columns: fields, rows: [] };
  }
}
