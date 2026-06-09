// ─────────────────────────────────────────────────────────────────────────────
// Scope / agent catalog
// The canonical list of discipline scopes. Each previous BOQ is analysed into a
// per-scope app-wide knowledge base keyed by agent_id, and each generation runs
// scope agents. (Section-level POMI/NRM2 sub-agents are layered on in Phase 2.)
// ─────────────────────────────────────────────────────────────────────────────

export type ScopeDef = {
  agentId: string;
  scope: string;
  keywords: string[];
};

export const SCOPES: ScopeDef[] = [
  {
    agentId: "architectural",
    scope: "Architectural",
    keywords: [
      "architect",
      "door",
      "window",
      "wall",
      "partition",
      "ceiling",
      "roof",
      "masonry",
      "blockwork",
      "cladding",
      "waterproofing"
    ]
  },
  {
    agentId: "internal-design",
    scope: "Internal Design",
    keywords: [
      "internal design",
      "interior",
      "finish",
      "finishes",
      "joinery",
      "tiling",
      "flooring",
      "painting",
      "decoration",
      "fit-out",
      "fit out"
    ]
  },
  {
    agentId: "structural",
    scope: "Structural",
    keywords: [
      "structural",
      "structure",
      "concrete",
      "reinforcement",
      "rebar",
      "formwork",
      "foundation",
      "column",
      "beam",
      "slab",
      "piling",
      "steelwork"
    ]
  },
  {
    agentId: "mep-mechanical",
    scope: "Mechanical",
    keywords: [
      "mechanical",
      "hvac",
      "ductwork",
      "duct",
      "ventilation",
      "chilled water",
      "air handling",
      "fcu",
      "ahu"
    ]
  },
  {
    agentId: "mep-electrical",
    scope: "Electrical",
    keywords: [
      "electrical",
      "lighting",
      "power",
      "cable",
      "containment",
      "distribution board",
      "small power",
      "lv ",
      "earthing"
    ]
  },
  {
    agentId: "mep-plumbing",
    scope: "Plumbing",
    keywords: [
      "plumbing",
      "drainage",
      "sanitary",
      "water supply",
      "pipework",
      "soil",
      "waste",
      "domestic water"
    ]
  },
  {
    agentId: "fire-fighting",
    scope: "Fire Fighting",
    keywords: [
      "fire fighting",
      "firefighting",
      "sprinkler",
      "fire pump",
      "hose reel",
      "fire suppression",
      "wet riser",
      "dry riser"
    ]
  },
  {
    agentId: "ffe",
    scope: "Furniture / FF&E",
    keywords: [
      "ff&e",
      "ffe",
      "furniture",
      "loose furniture",
      "fixtures and equipment",
      "furnishings"
    ]
  },
  {
    agentId: "landscape",
    scope: "Landscape",
    keywords: [
      "landscape",
      "planting",
      "soft landscape",
      "hard landscape",
      "irrigation",
      "external planting"
    ]
  },
  {
    agentId: "external-works",
    scope: "External Works",
    keywords: [
      "external works",
      "paving",
      "kerb",
      "road",
      "site works",
      "fencing",
      "external drainage"
    ]
  }
];

const GENERAL_SCOPE: ScopeDef = {
  agentId: "general",
  scope: "General",
  keywords: []
};

export function getScopeDefByAgentId(agentId: string): ScopeDef {
  return SCOPES.find((s) => s.agentId === agentId) ?? GENERAL_SCOPE;
}

/**
 * Resolve a free-text scope / discipline name (from a project or an LLM
 * response) to a known scope definition. Falls back to "General".
 */
export function resolveScope(name: string | null | undefined): ScopeDef {
  if (!name) return GENERAL_SCOPE;
  const lower = name.toLowerCase();

  // Exact scope-name match first.
  const exact = SCOPES.find((s) => s.scope.toLowerCase() === lower);
  if (exact) return exact;

  // Keyword / contains match.
  const byKeyword = SCOPES.find(
    (s) =>
      s.agentId === lower ||
      lower.includes(s.scope.toLowerCase()) ||
      s.keywords.some((kw) => lower.includes(kw))
  );
  return byKeyword ?? GENERAL_SCOPE;
}

/**
 * Given a project's (often combined) scope text, return all discipline scopes it
 * covers, e.g. "Architecture + Internal Design" -> architectural + internal-design.
 */
export function resolveProjectScopes(scopeText: string | null | undefined): ScopeDef[] {
  if (!scopeText) return [GENERAL_SCOPE];
  const lower = scopeText.toLowerCase();
  const matched = SCOPES.filter(
    (s) =>
      lower.includes(s.scope.toLowerCase()) ||
      s.keywords.some((kw) => lower.includes(kw))
  );
  return matched.length > 0 ? matched : [GENERAL_SCOPE];
}
