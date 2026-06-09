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
  'Use concise trade-specific descriptions matching the supplied bills, e.g. "50mm Blinding", "200mm insulated cavity wall with aluminum perforated steel, Ref; P10", "1100 x 2250mm, Type D3", and "Allow for ... complete as per Drawings and Specifications." Use template units such as nr, item, m, m2, m3, kg. Never generate quantities, rates, or amounts.'
)
on conflict (name)
do update set
  description = excluded.description,
  header_aliases = excluded.header_aliases,
  detection_rules = excluded.detection_rules,
  column_mapping = excluded.column_mapping,
  item_style_notes = excluded.item_style_notes,
  updated_at = now();
