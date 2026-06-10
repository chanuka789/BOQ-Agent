import { SCOPES, resolveScope } from "@/lib/agents/catalog";
import { getSectionAgents } from "@/lib/agents/sections";
import { normalizeSourceReference } from "@/lib/documents/source-reference";
import type { ScheduleType } from "@/lib/db/types";

export type ChunkClassification = {
  scope: string;
  discipline: string;
  documentType: string; // specification | drawing | schedule | room_data | general
  sectionCode: string | null;
  drawingRef: string | null;
  revisionRef: string | null;
};

const DOC_TYPE_KEYWORDS: Array<{ type: string; keywords: string[] }> = [
  { type: "schedule", keywords: ["schedule", "door schedule", "window schedule", "finishes schedule", "ironmongery schedule"] },
  { type: "room_data", keywords: ["room data sheet", "rds", "room data"] },
  { type: "specification", keywords: ["specification", "spec section", "shall be", "in accordance with", "to comply with", "clause"] },
  { type: "drawing", keywords: ["drawing", "dwg", "scale 1:", "section a-a", "detail", "legend", "title block", "north arrow"] }
];

export function classifyScope(text: string): { scope: string; discipline: string } {
  const lower = text.toLowerCase();
  let best = { scope: "General", score: 0 };
  for (const def of SCOPES) {
    let score = 0;
    if (lower.includes(def.scope.toLowerCase())) score += 3;
    for (const kw of def.keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > best.score) best = { scope: def.scope, score };
  }
  const discipline = best.scope === "General" ? "General" : resolveScope(best.scope).agentId;
  return { scope: best.scope, discipline };
}

export function classifyDocumentType(text: string, fileName: string): string {
  const hay = `${fileName} ${text}`.toLowerCase();
  for (const { type, keywords } of DOC_TYPE_KEYWORDS) {
    if (keywords.some((kw) => hay.includes(kw))) return type;
  }
  return "general";
}

/** Map a chunk to a POMI/NRM2 section code by matching section title words. */
export function detectSectionCode(text: string, standard: string): string | null {
  const agents = getSectionAgents(standard);
  if (agents.length === 0) return null;
  const lower = text.toLowerCase();

  let best: { code: string; score: number } | null = null;
  for (const agent of agents) {
    const titleWords = agent.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    let score = 0;
    for (const w of titleWords) {
      if (lower.includes(w)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { code: agent.code, score };
  }
  return best ? best.code : null;
}

const DRAWING_REF = /\b([A-Z]{1,3}[-_ ]?\d{2,4}[A-Z]?)\b/;
const REVISION = /\brev(?:ision)?\.?\s*[:#]?\s*([A-Z0-9]{1,3})\b/i;

export function extractDrawingRef(text: string): string | null {
  const head = text.slice(0, 600);
  if (/(drawing|dwg|sheet)\s*(no\.?|number|#|:)/i.test(head)) {
    const m = head.match(DRAWING_REF);
    if (m) return normalizeDrawingRef(m[1]);
  }
  // Generic discipline-prefixed sheet code anywhere near the top.
  const m = head.match(/\b([ASMEPL][-_]\d{2,4}[A-Z]?)\b/);
  return m ? normalizeDrawingRef(m[1]) : null;
}

function normalizeDrawingRef(value: string): string {
  const compact = normalizeSourceReference(value).toUpperCase();
  const match = compact.match(/^([A-Z]{1,4})(\d{2,5}[A-Z]?)$/);
  return match ? `${match[1]}-${match[2]}` : value.replace(/[_ ]/g, "-").toUpperCase();
}

export function extractRevision(text: string): string | null {
  const m = text.slice(0, 800).match(REVISION);
  return m ? m[1] : null;
}

export function classifyChunk(
  text: string,
  fileName: string,
  standard: string
): ChunkClassification {
  const { scope, discipline } = classifyScope(text);
  return {
    scope,
    discipline,
    documentType: classifyDocumentType(text, fileName),
    sectionCode: detectSectionCode(text, standard),
    drawingRef: extractDrawingRef(text),
    revisionRef: extractRevision(text)
  };
}

const SCHEDULE_SIGNATURES: Array<{ type: ScheduleType; keywords: string[] }> = [
  { type: "door", keywords: ["door schedule", "door type", "door ref", "ironmongery", "leaf", "fire rating"] },
  { type: "window", keywords: ["window schedule", "window type", "glazing", "frame material", "sill"] },
  { type: "finishes", keywords: ["finishes schedule", "floor finish", "wall finish", "ceiling finish", "skirting"] },
  { type: "sanitary", keywords: ["sanitary schedule", "sanitaryware", "wc", "wash basin", "water closet"] },
  { type: "lighting", keywords: ["lighting schedule", "luminaire", "light fitting", "lux"] },
  { type: "equipment", keywords: ["equipment schedule", "ff&e schedule", "appliance"] },
  { type: "room_data", keywords: ["room data sheet", "room data", "rds"] }
];

export function detectScheduleType(text: string): ScheduleType | null {
  const lower = text.toLowerCase();
  for (const { type, keywords } of SCHEDULE_SIGNATURES) {
    const hits = keywords.filter((kw) => lower.includes(kw)).length;
    if (hits >= 1 && lower.includes("schedule")) return type;
    if (hits >= 2) return type;
  }
  return null;
}
