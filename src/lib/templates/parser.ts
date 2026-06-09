import * as XLSX from "xlsx";
import type {
  TemplateColumnKey,
  TemplateColumnMap,
  TemplateParseResult,
  TemplateProfile,
  TemplateSheetKind,
  TemplateSheetStructure
} from "@/lib/templates/types";

const defaultProfile: TemplateProfile = {
  name: "U-View Main Package BOQ",
  headerAliases: {
    item: ["ITEM"],
    description: ["DESCRIPTION"],
    quantity: ["QTY.", "QTY"],
    unit: ["UNIT"],
    rate: ["RATE"],
    amount: ["AMOUNT"]
  },
  summarySheetNames: ["SUM", "MS"],
  indexSheetNames: ["INDEX"]
};

export async function parseBoqTemplate(
  data: ArrayBuffer,
  profile: TemplateProfile = defaultProfile
): Promise<TemplateParseResult> {
  const workbook = XLSX.read(data, {
    type: "array",
    cellFormula: true,
    cellDates: false
  });

  const sheets = workbook.SheetNames.map((name) =>
    parseSheet(workbook.Sheets[name], name, profile)
  );
  const detectedUnits = Array.from(
    new Set(
      sheets
        .flatMap((sheet) => sheet.itemSamples.map((sample) => sample.unit))
        .filter(Boolean)
        .map((unit) => unit.toLowerCase())
    )
  ).sort();

  return {
    profileName: profile.name,
    sheets,
    workSheetCount: sheets.filter((sheet) => sheet.kind === "work").length,
    summarySheetCount: sheets.filter((sheet) => sheet.kind === "summary").length,
    indexSheetCount: sheets.filter((sheet) => sheet.kind === "index").length,
    detectedUnits,
    styleNotes: buildStyleNotes(sheets)
  };
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  name: string,
  profile: TemplateProfile
): TemplateSheetStructure {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  const maxRow = range ? range.e.r + 1 : 0;
  const maxColumn = range ? range.e.c + 1 : 0;
  const header = findHeader(sheet, maxRow, maxColumn, profile);
  const normalizedName = name.trim().toUpperCase();
  const isSummary = profile.summarySheetNames.some(
    (sheetName) => sheetName.toUpperCase() === normalizedName
  );
  const isIndex = profile.indexSheetNames.some(
    (sheetName) => sheetName.toUpperCase() === normalizedName
  );
  const kind: TemplateSheetKind = isIndex
    ? "index"
    : isSummary
      ? "summary"
      : isWorkSheet(header.columns)
        ? "work"
        : "other";

  return {
    name,
    kind,
    headerRow: header.row,
    columns: header.columns,
    maxRow,
    maxColumn,
    sectionSamples: collectSectionSamples(sheet, maxRow, header),
    itemSamples: collectItemSamples(sheet, maxRow, header)
  };
}

function findHeader(
  sheet: XLSX.WorkSheet,
  maxRow: number,
  maxColumn: number,
  profile: TemplateProfile
) {
  const aliasLookup = new Map<string, TemplateColumnKey>();

  for (const [key, aliases] of Object.entries(profile.headerAliases) as Array<
    [TemplateColumnKey, string[]]
  >) {
    aliases.forEach((alias) => aliasLookup.set(normalizeHeader(alias), key));
  }

  for (let row = 0; row < Math.min(maxRow, 30); row += 1) {
    const columns: TemplateColumnMap = {};

    for (let column = 0; column < Math.min(maxColumn, 14); column += 1) {
      const raw = getCellText(sheet, row, column);
      const key = aliasLookup.get(normalizeHeader(raw));

      if (key) {
        columns[key] = column + 1;
      }
    }

    if (columns.item && columns.description) {
      return { row: row + 1, columns };
    }
  }

  return { row: null, columns: {} };
}

function isWorkSheet(columns: TemplateColumnMap) {
  return Boolean(
    columns.item &&
      columns.description &&
      columns.quantity &&
      columns.unit &&
      columns.rate &&
      columns.amount
  );
}

function collectSectionSamples(
  sheet: XLSX.WorkSheet,
  maxRow: number,
  header: { row: number | null; columns: TemplateColumnMap }
) {
  if (!header.row || !header.columns.description) {
    return [];
  }

  const samples: string[] = [];
  const descriptionColumn = header.columns.description - 1;
  const unitColumn = header.columns.unit ? header.columns.unit - 1 : null;

  for (let row = header.row; row < Math.min(maxRow, header.row + 140); row += 1) {
    const description = getCellText(sheet, row, descriptionColumn);
    const unit = unitColumn === null ? "" : getCellText(sheet, row, unitColumn);

    if (
      description.length > 7 &&
      !unit &&
      (description === description.toUpperCase() ||
        /^DIVISION\s+\d+/i.test(description) ||
        /^PART\s+\d+/i.test(description))
    ) {
      samples.push(description);
    }

    if (samples.length >= 8) {
      break;
    }
  }

  return samples;
}

function collectItemSamples(
  sheet: XLSX.WorkSheet,
  maxRow: number,
  header: { row: number | null; columns: TemplateColumnMap }
) {
  if (!header.row || !header.columns.description || !header.columns.unit) {
    return [];
  }

  const samples: TemplateSheetStructure["itemSamples"] = [];
  const itemColumn = (header.columns.item ?? 1) - 1;
  const descriptionColumn = header.columns.description - 1;
  const unitColumn = header.columns.unit - 1;

  for (let row = header.row; row < Math.min(maxRow, header.row + 180); row += 1) {
    const itemNo = getCellText(sheet, row, itemColumn);
    const description = getCellText(sheet, row, descriptionColumn);
    const unit = getCellText(sheet, row, unitColumn);

    if (
      description &&
      unit &&
      description.toUpperCase() !== "DESCRIPTION" &&
      unit.toUpperCase() !== "UNIT"
    ) {
      samples.push({
        row: row + 1,
        itemNo,
        description,
        unit
      });
    }

    if (samples.length >= 10) {
      break;
    }
  }

  return samples;
}

function buildStyleNotes(sheets: TemplateSheetStructure[]) {
  const sampleDescriptions = sheets
    .filter((sheet) => sheet.kind === "work")
    .flatMap((sheet) => sheet.itemSamples)
    .slice(0, 14)
    .map((sample) => `${sample.description} [${sample.unit}]`);

  return [
    "Preserve Index, SUM/MS, and bill/division sheets from the uploaded workbook.",
    "Use the workbook's detected item, description, quantity, unit, rate, and amount columns for export.",
    "Generate description and unit only. Keep quantity, rate, and amount cells blank.",
    "Prefer concise BOQ wording with dimensions, type/reference codes, location/scope, and 'Allow for ... complete as per Drawings and Specifications' when the source indicates an allowance.",
    ...sampleDescriptions
  ];
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").replace(/\./g, "").trim().toUpperCase();
}

function getCellText(sheet: XLSX.WorkSheet, row: number, column: number) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = sheet[address];

  if (!cell) {
    return "";
  }

  if (typeof cell.v === "string") {
    return cell.v.replace(/\s+/g, " ").trim();
  }

  if (typeof cell.w === "string") {
    return cell.w.replace(/\s+/g, " ").trim();
  }

  if (cell.v === null || cell.v === undefined) {
    return "";
  }

  return String(cell.v).replace(/\s+/g, " ").trim();
}
