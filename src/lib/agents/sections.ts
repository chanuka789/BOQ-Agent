// ─────────────────────────────────────────────────────────────────────────────
// Measurement-standard section-agent registry
//   * POMI  — 17 section agents (GP, A–R)
//   * NRM2  — 41 work-section agents
//   * NRM1  — elemental cost-plan agents (separate from detailed BOQ logic)
// Each section agent is mapped to a discipline scope so it can be auto-skipped
// when no relevant documents are uploaded, and so it reads the matching app-wide
// scope knowledge base.
// ─────────────────────────────────────────────────────────────────────────────

import { SCOPES, resolveProjectScopes } from "@/lib/agents/catalog";

export type SectionStandard = "POMI" | "NRM2" | "NRM1";

export type SectionAgent = {
  agentId: string; // stable id, e.g. "pomi-J", "nrm2-24", "nrm1-3"
  standard: SectionStandard;
  code: string; // "J", "24", "3"
  title: string; // "Finishes"
  label: string; // "POMI Section J Agent — Finishes"
  scope: string; // discipline scope (matches catalog SCOPES) or "General"
  units: string[]; // typical units hint
  alwaysRun?: boolean; // preliminaries / general / cost-plan elements
};

const ARCH = "Architectural";
const ID = "Internal Design";
const STR = "Structural";
const MECH = "Mechanical";
const ELEC = "Electrical";
const PLUMB = "Plumbing";
const FIRE = "Fire Fighting";
const FFE = "Furniture / FF&E";
const LAND = "Landscape";
const EXT = "External Works";
const GEN = "General";

// ── POMI section agents (17) ────────────────────────────────────────────────
const POMI: Array<Omit<SectionAgent, "agentId" | "standard" | "label">> = [
  { code: "GP", title: "General Principles", scope: GEN, units: ["item"], alwaysRun: true },
  { code: "A", title: "General Requirements", scope: GEN, units: ["item"], alwaysRun: true },
  { code: "B", title: "Site Work", scope: EXT, units: ["m2", "m3", "m", "nr"] },
  { code: "C", title: "Concrete Work", scope: STR, units: ["m3", "m2", "t"] },
  { code: "D", title: "Masonry", scope: ARCH, units: ["m2", "m3"] },
  { code: "E", title: "Metalwork", scope: STR, units: ["kg", "t", "m", "nr"] },
  { code: "F", title: "Woodwork", scope: ID, units: ["m2", "m", "nr"] },
  { code: "G", title: "Thermal and Moisture Protection", scope: ARCH, units: ["m2", "m"] },
  { code: "H", title: "Doors and Windows", scope: ARCH, units: ["nr", "m2"] },
  { code: "J", title: "Finishes", scope: ID, units: ["m2", "m"] },
  { code: "K", title: "Accessories", scope: ID, units: ["nr", "m"] },
  { code: "L", title: "Equipment", scope: FFE, units: ["nr", "item"] },
  { code: "M", title: "Furnishings", scope: FFE, units: ["nr", "item"] },
  { code: "N", title: "Special Construction", scope: GEN, units: ["item", "nr"] },
  { code: "P", title: "Conveying Systems", scope: MECH, units: ["nr", "item"] },
  { code: "Q", title: "Mechanical Engineering Installations", scope: MECH, units: ["nr", "m", "item"] },
  { code: "R", title: "Electrical Engineering Installations", scope: ELEC, units: ["nr", "m", "item"] }
];

// ── NRM2 work-section agents (41) ───────────────────────────────────────────
const NRM2: Array<Omit<SectionAgent, "agentId" | "standard" | "label">> = [
  { code: "1", title: "Preliminaries", scope: GEN, units: ["item"], alwaysRun: true },
  { code: "2", title: "Off-site manufactured materials, components and buildings", scope: ARCH, units: ["nr", "item"] },
  { code: "3", title: "Demolitions", scope: STR, units: ["item", "m3"] },
  { code: "4", title: "Alterations, repairs and conservation", scope: ARCH, units: ["item", "m2", "nr"] },
  { code: "5", title: "Excavating and filling", scope: STR, units: ["m3", "m2"] },
  { code: "6", title: "Ground remediation and soil stabilisation", scope: STR, units: ["m3", "m2"] },
  { code: "7", title: "Piling", scope: STR, units: ["m", "nr"] },
  { code: "8", title: "Underpinning", scope: STR, units: ["m", "m3", "nr"] },
  { code: "9", title: "Diaphragm walls and embedded retaining walls", scope: STR, units: ["m2", "m3"] },
  { code: "10", title: "Crib walls, gabions and reinforced earth", scope: STR, units: ["m2", "m3"] },
  { code: "11", title: "In-situ concrete works", scope: STR, units: ["m3", "m2", "t"] },
  { code: "12", title: "Precast/composite concrete", scope: STR, units: ["m2", "nr", "m"] },
  { code: "13", title: "Precast concrete", scope: STR, units: ["nr", "m", "m2"] },
  { code: "14", title: "Masonry", scope: ARCH, units: ["m2", "m3"] },
  { code: "15", title: "Structural metalwork", scope: STR, units: ["t", "kg", "nr"] },
  { code: "16", title: "Carpentry", scope: ARCH, units: ["m", "m2", "nr"] },
  { code: "17", title: "Sheet roof coverings", scope: ARCH, units: ["m2", "m"] },
  { code: "18", title: "Tile and slate roof and wall coverings", scope: ARCH, units: ["m2", "m"] },
  { code: "19", title: "Waterproofing", scope: ARCH, units: ["m2", "m"] },
  { code: "20", title: "Proprietary linings and partitions", scope: ID, units: ["m2", "m"] },
  { code: "21", title: "Cladding and covering", scope: ARCH, units: ["m2", "m"] },
  { code: "22", title: "General joinery", scope: ID, units: ["m", "m2", "nr"] },
  { code: "23", title: "Windows, screens and lights", scope: ARCH, units: ["nr", "m2"] },
  { code: "24", title: "Doors, shutters and hatches", scope: ARCH, units: ["nr", "m2"] },
  { code: "25", title: "Stairs, walkways and balustrades", scope: ARCH, units: ["nr", "m"] },
  { code: "26", title: "Metalwork", scope: ARCH, units: ["nr", "m", "kg"] },
  { code: "27", title: "Glazing", scope: ARCH, units: ["m2", "nr"] },
  { code: "28", title: "Floor, wall, ceiling and roof finishings", scope: ID, units: ["m2", "m"] },
  { code: "29", title: "Decoration", scope: ID, units: ["m2", "m"] },
  { code: "30", title: "Suspended ceilings", scope: ID, units: ["m2", "m"] },
  { code: "31", title: "Insulation, fire stopping and fire protection", scope: ARCH, units: ["m2", "m", "nr"] },
  { code: "32", title: "Furniture, fittings and equipment", scope: FFE, units: ["nr", "item"] },
  { code: "33", title: "Drainage above ground", scope: PLUMB, units: ["m", "nr"] },
  { code: "34", title: "Drainage below ground", scope: PLUMB, units: ["m", "nr"] },
  { code: "35", title: "Site works", scope: EXT, units: ["m2", "m", "m3", "nr"] },
  { code: "36", title: "Fencing", scope: EXT, units: ["m", "nr"] },
  { code: "37", title: "Soft landscaping", scope: LAND, units: ["m2", "nr", "item"] },
  { code: "38", title: "Mechanical services", scope: MECH, units: ["nr", "m", "item"] },
  { code: "39", title: "Electrical services", scope: ELEC, units: ["nr", "m", "item"] },
  { code: "40", title: "Transportation systems", scope: MECH, units: ["nr", "item"] },
  { code: "41", title: "Builder's work in connection with mechanical, electrical and transportation installations", scope: GEN, units: ["item", "nr", "m"] }
];

// ── NRM1 elemental cost-plan agents (separate from detailed BOQ logic) ───────
// NRM1 is cost planning: produce elemental descriptions, not detailed measured
// items. These run for the elemental structure regardless of detailed drawings.
const NRM1: Array<Omit<SectionAgent, "agentId" | "standard" | "label">> = [
  { code: "0", title: "Facilitating works", scope: GEN, units: ["item"], alwaysRun: true },
  { code: "1", title: "Substructure", scope: STR, units: ["m2", "item"], alwaysRun: true },
  { code: "2", title: "Superstructure", scope: ARCH, units: ["m2", "item"], alwaysRun: true },
  { code: "3", title: "Internal finishes", scope: ID, units: ["m2", "item"], alwaysRun: true },
  { code: "4", title: "Fittings, furnishings and equipment", scope: FFE, units: ["nr", "item"], alwaysRun: true },
  { code: "5", title: "Services", scope: MECH, units: ["m2", "item"], alwaysRun: true },
  { code: "6", title: "Prefabricated buildings and building units", scope: GEN, units: ["nr", "item"], alwaysRun: true },
  { code: "7", title: "Work to existing buildings", scope: ARCH, units: ["item", "m2"], alwaysRun: true },
  { code: "8", title: "External works", scope: EXT, units: ["m2", "item"], alwaysRun: true },
  { code: "9", title: "Main contractor's preliminaries", scope: GEN, units: ["item"], alwaysRun: true },
  { code: "10", title: "Main contractor's overheads and profit", scope: GEN, units: ["item"], alwaysRun: true }
];

function build(
  standard: SectionStandard,
  list: Array<Omit<SectionAgent, "agentId" | "standard" | "label">>
): SectionAgent[] {
  const prefix =
    standard === "POMI" ? "POMI Section" : standard === "NRM2" ? "NRM2 Work Section" : "NRM1 Element";
  return list.map((s) => ({
    ...s,
    agentId: `${standard.toLowerCase()}-${s.code}`,
    standard,
    label: `${prefix} ${s.code} Agent — ${s.title}`
  }));
}

const REGISTRY: Record<SectionStandard, SectionAgent[]> = {
  POMI: build("POMI", POMI),
  NRM2: build("NRM2", NRM2),
  NRM1: build("NRM1", NRM1)
};

export function getSectionAgents(standard: string): SectionAgent[] {
  if (standard === "POMI" || standard === "NRM2" || standard === "NRM1") {
    return REGISTRY[standard];
  }
  return [];
}

export type FileSignal = {
  fileName: string;
  documentType?: string | null;
  scope?: string | null;
  textSample?: string;
};

/**
 * Detect which discipline scopes have relevant uploaded documents by matching
 * the document signals against each scope's keywords.
 */
export function detectAvailableScopes(signals: FileSignal[]): Set<string> {
  const available = new Set<string>([GEN]);

  for (const signal of signals) {
    const haystack = [
      signal.fileName,
      signal.documentType ?? "",
      signal.scope ?? "",
      signal.textSample ?? ""
    ]
      .join(" ")
      .toLowerCase();

    // Explicit scope classification on the file.
    for (const scopeDef of SCOPES) {
      if (
        haystack.includes(scopeDef.scope.toLowerCase()) ||
        scopeDef.keywords.some((kw) => haystack.includes(kw))
      ) {
        available.add(scopeDef.scope);
      }
    }
  }

  return available;
}

export type AgentSelection = {
  run: SectionAgent[];
  skipped: Array<{ agent: SectionAgent; reason: string }>;
  availableScopes: string[];
};

/**
 * Decide which section agents run for a generation. A section agent runs when
 * its discipline scope has documents (or it is alwaysRun). Disciplines with no
 * documents are skipped with a clear reason. Falls back to the declared project
 * scopes if document detection finds nothing specific.
 */
export function selectSectionAgents({
  standard,
  projectScope,
  signals
}: {
  standard: string;
  projectScope: string;
  signals: FileSignal[];
}): AgentSelection {
  const agents = getSectionAgents(standard);
  if (agents.length === 0) {
    return { run: [], skipped: [], availableScopes: [] };
  }

  // NRM1 is elemental cost planning — run the full elemental structure.
  if (standard === "NRM1") {
    return {
      run: agents,
      skipped: [],
      availableScopes: Array.from(new Set(agents.map((a) => a.scope)))
    };
  }

  const detected = detectAvailableScopes(signals);
  const detectedDisciplines = Array.from(detected).filter((s) => s !== GEN);

  // Fallback to the declared project scopes when detection finds no discipline.
  const available =
    detectedDisciplines.length > 0
      ? detected
      : new Set<string>([GEN, ...resolveProjectScopes(projectScope).map((s) => s.scope)]);

  const run: SectionAgent[] = [];
  const skipped: AgentSelection["skipped"] = [];

  for (const agent of agents) {
    if (agent.alwaysRun || available.has(agent.scope)) {
      run.push(agent);
    } else {
      skipped.push({
        agent,
        reason: `Skipped — no ${agent.scope} documents uploaded.`
      });
    }
  }

  return { run, skipped, availableScopes: Array.from(available) };
}
