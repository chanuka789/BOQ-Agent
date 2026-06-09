-- Template profiles let the app support multiple BOQ workbook formats over time.
-- The U-View profile is based on the supplied Bill No. 1 to Bill No. 8.4 workbooks.

insert into boq_template_profiles (
  name,
  description,
  header_aliases,
  detection_rules,
  column_mapping,
  item_style_notes
)
values (
  'U-View Main Package BOQ',
  'Supplied U-View Jeddah Tower main package bill format: index sheet, division/part sheets, and summary sheets.',
  '{
    "item": ["ITEM"],
    "description": ["DESCRIPTION"],
    "quantity": ["QTY.", "QTY"],
    "unit": ["UNIT"],
    "rate": ["RATE"],
    "amount": ["AMOUNT"]
  }'::jsonb,
  '{
    "headerRows": [5, 7, 8],
    "workSheetRequiredColumns": ["item", "description", "quantity", "unit", "rate", "amount"],
    "summarySheetNames": ["SUM", "MS"],
    "indexSheetNames": ["Index"],
    "preserveSheets": true
  }'::jsonb,
  '{
    "default": {
      "item": 1,
      "description": 2,
      "quantity": 3,
      "unit": 4,
      "rate": 5,
      "amount": 6
    },
    "summary": {
      "item": 1,
      "description": 3,
      "amount": 5
    }
  }'::jsonb,
  'U-View Jeddah Tower POMI/CSI bill format. Column layout: ITEM (A) | DESCRIPTION (B) | QTY. (C) | UNIT (D) | RATE (E) | AMOUNT (F). Arial 11pt throughout. Item codes: A B C D E F G H J K L M N P Q R S (skip I and O). Each division sheet uses structure: project header rows → column headers (row 5) → division heading → preamble note → spec section heading (e.g. "03 3000 : CAST IN PLACE CONCRETE") → POMI section reference (e.g. "POMI Section C2") → sub-headings (SUBSTRUCTURE / SUPERSTRUCTURE / FOH / BOH / Floor Finishes / Wall Finishes / Ceiling Finishes) → measured items. Preamble description pattern: "Supply and installation of [work type] including [components] and all necessary accessories; complete, all in accordance with the Drawings and Specifications." Measured sub-items: concise noun phrases, use "Ditto" for same item type at different size (e.g. "Core walls, 300mm thick" / "Ditto, 500mm thick"). End each page section with "CARRIED TO COLLECTION". Collection page lists all CTC subtotals and closes with "CARRIED TO BILL SUMMARY". Bill Summary sheet (SUM) columns: ITEM | REFERENCE | DESCRIPTION | PAGE NO. | AMOUNT. Units: m3 (concrete), m2 (finishes/formwork/walls), m (linear), t (reinforcement), nr (doors/windows/fixtures), kg (steelwork), item (lump sum). Never generate quantities, rates, or amounts.'
)
on conflict (name)
do update set
  description = excluded.description,
  header_aliases = excluded.header_aliases,
  detection_rules = excluded.detection_rules,
  column_mapping = excluded.column_mapping,
  item_style_notes = excluded.item_style_notes,
  updated_at = now();
