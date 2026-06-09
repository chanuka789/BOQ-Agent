import "server-only";

import ExcelJS from "exceljs";
import type {
  BoqAssumptionRow,
  BoqItemRow,
  BoqQueryRow,
  ProjectRow
} from "@/lib/db/types";

// Minimal shape used for the learned summary note / sources — satisfied by the
// app-wide knowledge base rows (active records).
export type ExportKnowledge = {
  status: string;
  summary_structure: string | null;
  source_file_name: string | null;
};

const REVIEW_NOTICE =
  "AI-generated draft — review required before pricing or tender. Quantities, rates and amounts are intentionally left blank for the Quantity Surveyor.";

const PRIMARY = "FF1F4E79";
const HEADER_FILL = "FF1F4E79";
const SECTION_FILL = "FFE7EEF6";
const SUBHEADING_FILL = "FFF2F6FB";
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFC9D6" } },
  left: { style: "thin", color: { argb: "FFBFC9D6" } },
  bottom: { style: "thin", color: { argb: "FFBFC9D6" } },
  right: { style: "thin", color: { argb: "FFBFC9D6" } }
};

type ExportData = {
  project: ProjectRow;
  items: BoqItemRow[];
  assumptions: BoqAssumptionRow[];
  queries: BoqQueryRow[];
  knowledge: ExportKnowledge[];
  generationLabel?: string;
};

function groupBySection(items: BoqItemRow[]) {
  const sections = new Map<string, BoqItemRow[]>();
  for (const item of items) {
    const key = item.section || "General";
    if (!sections.has(key)) {
      sections.set(key, []);
    }
    sections.get(key)!.push(item);
  }
  return sections;
}

export async function buildBoqWorkbook(data: ExportData): Promise<ExcelJS.Buffer> {
  const { project, items, assumptions, queries, knowledge, generationLabel } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI BOQ Drafting Agent";
  wb.created = new Date();

  buildBoqSheet(wb, project, items, generationLabel);
  buildSummarySheet(wb, project, items, knowledge);
  buildAssumptionsSheet(wb, assumptions);
  buildQueriesSheet(wb, queries);
  buildNoticeSheet(wb, project, knowledge);

  return wb.xlsx.writeBuffer();
}

function buildBoqSheet(
  wb: ExcelJS.Workbook,
  project: ProjectRow,
  items: BoqItemRow[],
  generationLabel?: string
) {
  const ws = wb.addWorksheet("BOQ", {
    views: [{ state: "frozen", ySplit: 6 }]
  });

  ws.columns = [
    { key: "item", width: 8 },
    { key: "description", width: 64 },
    { key: "unit", width: 10 },
    { key: "quantity", width: 12 },
    { key: "rate", width: 12 },
    { key: "amount", width: 14 }
  ];

  // Title block
  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${project.name} — Bill of Quantities (Draft)${
    generationLabel ? ` · ${generationLabel}` : ""
  }`;
  titleCell.font = { bold: true, size: 14, color: { argb: PRIMARY } };

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Client: ${project.client_name}    Scope: ${project.scope}    Measurement method: ${project.measurement_standard}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF475569" } };

  ws.mergeCells("A3:F3");
  const noticeCell = ws.getCell("A3");
  noticeCell.value = REVIEW_NOTICE;
  noticeCell.font = { italic: true, size: 9, color: { argb: "FFB45309" } };
  noticeCell.alignment = { wrapText: true };
  ws.getRow(3).height = 26;

  // Header row (row 6 — kept frozen)
  const headerRowNumber = 6;
  const headerRow = ws.getRow(headerRowNumber);
  headerRow.values = ["Item", "Description", "Unit", "Quantity", "Rate", "Amount"];
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 20;

  const sections = groupBySection(items);

  for (const [sectionName, sectionItems] of sections) {
    // Section header row spanning the table
    const sectionRow = ws.addRow([sectionName, "", "", "", "", ""]);
    ws.mergeCells(`A${sectionRow.number}:F${sectionRow.number}`);
    const sc = sectionRow.getCell(1);
    sc.font = { bold: true, size: 11, color: { argb: PRIMARY } };
    sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
    sectionRow.eachCell((cell) => (cell.border = THIN_BORDER));

    for (const item of sectionItems) {
      const isHeading = item.item_type === "sub_heading";
      const isPreamble = item.item_type === "preamble";
      const blank = ""; // quantity / rate / amount stay blank

      const row = ws.addRow([
        item.item_no && item.item_no !== "-" ? item.item_no : "",
        item.description,
        isHeading || isPreamble ? "" : item.unit,
        blank,
        blank,
        blank
      ]);

      const descCell = row.getCell(2);
      descCell.alignment = { wrapText: true, vertical: "top" };
      row.getCell(3).alignment = { horizontal: "center", vertical: "top" };
      row.getCell(1).alignment = { horizontal: "center", vertical: "top" };

      if (isHeading) {
        descCell.font = { bold: true };
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: SUBHEADING_FILL }
          };
        });
      } else if (isPreamble) {
        descCell.font = { italic: true };
      }

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = THIN_BORDER;
      });
    }

    // Carried to collection placeholder (amount blank for QS)
    const collectionRow = ws.addRow(["", "Carried to Collection", "", "", "", ""]);
    collectionRow.getCell(2).font = { bold: true, italic: true };
    collectionRow.getCell(2).alignment = { horizontal: "right" };
    collectionRow.eachCell({ includeEmpty: true }, (cell) => (cell.border = THIN_BORDER));
  }

  if (items.length === 0) {
    const row = ws.addRow(["", "No BOQ items generated yet.", "", "", "", ""]);
    row.getCell(2).font = { italic: true, color: { argb: "FF94A3B8" } };
  }
}

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  project: ProjectRow,
  items: BoqItemRow[],
  knowledge: ExportKnowledge[]
) {
  const ws = wb.addWorksheet("Summary");
  ws.columns = [
    { key: "section", width: 60 },
    { key: "amount", width: 18 }
  ];

  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = `${project.name} — Summary / Collection`;
  ws.getCell("A1").font = { bold: true, size: 13, color: { argb: PRIMARY } };

  const learnedSummary = knowledge.find(
    (row) => row.status !== "disabled" && row.summary_structure
  )?.summary_structure;
  if (learnedSummary) {
    ws.mergeCells("A2:B2");
    ws.getCell("A2").value = `Summary layout learned from previous BOQs: ${learnedSummary}`;
    ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF475569" } };
    ws.getCell("A2").alignment = { wrapText: true };
    ws.getRow(2).height = 28;
  }

  const headerRow = ws.addRow(["Bill / Section", "Amount"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = THIN_BORDER;
  });

  const sections = groupBySection(items);
  for (const sectionName of sections.keys()) {
    const row = ws.addRow([sectionName, ""]); // amount blank for QS
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = THIN_BORDER));
  }

  const totalRow = ws.addRow(["TOTAL (excl. quantities, rates, amounts)", ""]);
  totalRow.getCell(1).font = { bold: true };
  totalRow.eachCell({ includeEmpty: true }, (cell) => (cell.border = THIN_BORDER));
}

function buildAssumptionsSheet(
  wb: ExcelJS.Workbook,
  assumptions: BoqAssumptionRow[]
) {
  const ws = wb.addWorksheet("Assumptions");
  ws.columns = [
    { key: "no", width: 6 },
    { key: "assumption", width: 80 },
    { key: "source", width: 32 }
  ];

  const headerRow = ws.addRow(["No.", "Assumption", "Source reference"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = THIN_BORDER;
  });

  assumptions.forEach((row, index) => {
    const r = ws.addRow([index + 1, row.assumption, row.source_reference ?? ""]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.eachCell({ includeEmpty: true }, (cell) => (cell.border = THIN_BORDER));
  });

  if (assumptions.length === 0) {
    ws.addRow(["", "No assumptions recorded.", ""]);
  }
}

function buildQueriesSheet(wb: ExcelJS.Workbook, queries: BoqQueryRow[]) {
  const ws = wb.addWorksheet("Queries (RFI)");
  ws.columns = [
    { key: "no", width: 6 },
    { key: "issue", width: 44 },
    { key: "clarification", width: 50 },
    { key: "source", width: 28 },
    { key: "status", width: 12 }
  ];

  const headerRow = ws.addRow([
    "No.",
    "Issue",
    "Clarification needed",
    "Source reference",
    "Status"
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = THIN_BORDER;
  });

  queries.forEach((row, index) => {
    const r = ws.addRow([
      index + 1,
      row.issue,
      row.clarification_needed,
      row.source_reference ?? "",
      row.status
    ]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(3).alignment = { wrapText: true, vertical: "top" };
    r.eachCell({ includeEmpty: true }, (cell) => (cell.border = THIN_BORDER));
  });

  if (queries.length === 0) {
    ws.addRow(["", "No queries raised.", "", "", ""]);
  }
}

function buildNoticeSheet(
  wb: ExcelJS.Workbook,
  project: ProjectRow,
  knowledge: ExportKnowledge[]
) {
  const ws = wb.addWorksheet("AI Review Notice");
  ws.columns = [{ width: 100 }];

  const title = ws.addRow(["AI-generated BOQ draft"]);
  title.getCell(1).font = { bold: true, size: 14, color: { argb: PRIMARY } };

  const lines = [
    "",
    REVIEW_NOTICE,
    "",
    `Measurement method: ${project.measurement_standard}`,
    "This draft contains BOQ item descriptions, headings, trade sections and units only.",
    "Quantity, rate and amount columns are intentionally left blank for the Quantity Surveyor.",
    "Every item must be checked by a qualified QS before being used for pricing or tender.",
    ""
  ];

  const analyzed = knowledge.filter((row) => row.status !== "disabled");
  if (analyzed.length > 0) {
    lines.push(
      `Style learned from ${analyzed.length} previous BOQ${analyzed.length > 1 ? "s" : ""}:`
    );
    for (const row of analyzed) {
      lines.push(`• ${row.source_file_name ?? "Previous BOQ"}`);
    }
  }

  for (const line of lines) {
    const r = ws.addRow([line]);
    r.getCell(1).alignment = { wrapText: true };
  }
}
