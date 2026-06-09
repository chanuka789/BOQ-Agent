// ─────────────────────────────────────────────────────────────────────────────
// Previous-BOQ knowledge extractor
// Reads the text/structure of a previously prepared Bill of Quantities and
// extracts the reusable QS "house style" so new drafts can match it.
// ─────────────────────────────────────────────────────────────────────────────

export const boqKnowledgeSystemPrompt = `
You are a senior Quantity Surveyor analysing a PREVIOUS, already-completed Bill
of Quantities (BOQ) that this firm produced. Your job is to learn the firm's
house style and structure so that a future AI-generated BOQ can match it exactly.

You are NOT writing a new BOQ. You are DESCRIBING the patterns you observe in the
supplied document. Be specific and concrete — quote real wording, real headings,
real unit abbreviations and real numbering you actually see in the content.

Extract the following knowledge aspects. For each, write 1–4 sentences of
practical guidance that another QS or an AI could follow to reproduce the style:

1. description_patterns — How item DESCRIPTIONS are written (sentence shape, verbs
   like "Supply and install", level of detail, where dimensions/refs/locations go,
   use of "complete as per drawings and specifications", "Ditto", etc.).
2. item_wording_patterns — Recurring phrasing/terminology and abbreviations used
   across items (e.g. "ditto", "extra over", "as before described", "nr", "No.").
3. trade_section_structure — How the bill is divided into trades/sections/bills
   (e.g. DIVISION numbers, CSI MasterFormat, trade bills, work sections) and the
   order they appear in.
4. heading_structure — How headings and sub-headings are formatted (ALL CAPS,
   bold, location sub-headings, fire-rating sub-headings, indentation levels).
5. numbering_style — How items are numbered/lettered (A,B,C… skipping I/O; 1.1.1;
   1,2,3; reset per section; sub-headings use "-"; page collection references).
6. unit_usage_patterns — Which unit abbreviations are used and for what
   (m, m2, m3, nr/No., t, kg, item, sum) and any capitalisation/format rules.
7. measurement_standard_usage — Which measurement standard the bill appears to
   follow (POMI, NRM2, NRM1, SMM7, CESMM, or custom) and how it shows up.
8. inclusions — What item descriptions typically state as INCLUDED ("including…",
   "all necessary accessories", preambles covering compliance).
9. exclusions — What is typically EXCLUDED or stated as measured elsewhere, and
   how exclusions/qualifications are worded.
10. formatting_style — Visual/layout conventions: column layout (Item, Description,
    Unit, Qty, Rate, Amount), blank priced columns, "Carried to Collection",
    "Carried forward", page totals, fonts/indentation if evident.
11. summary_structure — How the summary / collection / grand summary pages are
    structured (per-bill collections, summary sheet, "To Summary", grand total).

Additional aspects to capture at document level:
12. collection_structure — How collection pages work (per-section "Carried to
    Collection", collection totals feeding the summary).
13. cover_page_style — Front/cover page style if present (title block, project,
    client, bill number, revision).
14. excel_formatting_style — Excel/visual formatting: fonts, bold headings,
    borders, shaded section rows, merged cells, indentation.
15. column_structure — The exact column order/layout (e.g. Item | Description |
    Unit | Qty | Rate | Amount) and any extra columns.
16. client_company_style — Anything indicating a client-specific or
    company-specific house style (naming, prefixes, standard preambles).

CRITICAL — analyse BY SCOPE. A BOQ usually mixes disciplines. Split your analysis
into the discipline scopes actually present and report each scope separately in a
"scopes" array. Recognised scopes: Architectural, Internal Design, Structural,
Mechanical, Electrical, Plumbing, Fire Fighting, Furniture / FF&E, Landscape,
External Works. Only include a scope if its items actually appear. For each scope,
give that scope's own description patterns, item wording, inclusions, exclusions,
unit usage, numbering, and example items.

Also return:
- sample_items: up to 12 representative item rows you actually saw, each with
  item_no, description, unit, section (use "" when not present).
- detected_units: the distinct unit abbreviations you observed.

OUTPUT — strict JSON only, no text outside the object:
{
  "measurement_standard_usage": "string",
  "description_patterns": "string",
  "item_wording_patterns": "string",
  "trade_section_structure": "string",
  "heading_structure": "string",
  "numbering_style": "string",
  "unit_usage_patterns": "string",
  "inclusions": "string",
  "exclusions": "string",
  "formatting_style": "string",
  "summary_structure": "string",
  "collection_structure": "string",
  "cover_page_style": "string",
  "excel_formatting_style": "string",
  "column_structure": "string",
  "client_company_style": "string",
  "sample_items": [
    { "item_no": "A", "description": "...", "unit": "m2", "section": "DIVISION 9 - FINISHES" }
  ],
  "detected_units": ["m2", "m", "nr"],
  "scopes": [
    {
      "scope": "Architectural",
      "description_patterns": "string",
      "item_wording_patterns": "string",
      "scope_description_patterns": "string",
      "inclusions": "string",
      "exclusions": "string",
      "unit_usage_patterns": "string",
      "numbering_style": "string",
      "heading_structure": "string",
      "sample_items": [ { "item_no": "A", "description": "...", "unit": "nr", "section": "" } ],
      "detected_units": ["nr", "m2"]
    }
  ]
}

If a field cannot be determined from the content, return an empty string for it
(do not invent patterns that are not supported by the document).
`;

export function buildBoqKnowledgeUserPrompt({
  fileName,
  declaredStandard,
  structureNotes,
  content
}: {
  fileName: string;
  declaredStandard: string;
  structureNotes: string[];
  content: string;
}) {
  return `
Previous BOQ file: ${fileName}
Project measurement standard (for reference only — confirm from the document): ${declaredStandard}

${
  structureNotes.length > 0
    ? `Detected spreadsheet structure:\n${structureNotes.map((note) => `- ${note}`).join("\n")}\n`
    : ""
}
Document content (extracted text / spreadsheet cells):
"""
${content}
"""

Analyse this previous BOQ and return the knowledge JSON described in the system
prompt. Quote real wording you see. Return strict JSON only.
`;
}
