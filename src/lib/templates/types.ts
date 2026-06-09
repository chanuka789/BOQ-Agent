export type TemplateColumnKey =
  | "item"
  | "description"
  | "quantity"
  | "unit"
  | "rate"
  | "amount";

export type TemplateSheetKind = "work" | "summary" | "index" | "other";

export type TemplateColumnMap = Partial<Record<TemplateColumnKey, number>>;

export type TemplateProfile = {
  id?: string;
  name: string;
  headerAliases: Record<TemplateColumnKey, string[]>;
  summarySheetNames: string[];
  indexSheetNames: string[];
};

export type TemplateSheetStructure = {
  name: string;
  kind: TemplateSheetKind;
  headerRow: number | null;
  columns: TemplateColumnMap;
  maxRow: number;
  maxColumn: number;
  sectionSamples: string[];
  itemSamples: Array<{
    row: number;
    itemNo: string;
    description: string;
    unit: string;
  }>;
};

export type TemplateParseResult = {
  profileName: string;
  workbookName?: string;
  sheets: TemplateSheetStructure[];
  workSheetCount: number;
  summarySheetCount: number;
  indexSheetCount: number;
  detectedUnits: string[];
  styleNotes: string[];
};
