# Supplied BOQ Template Findings

The supplied U-View BOQ workbooks are the first supported template profile.

## Workbook Pattern

- Workbooks usually include an `Index` sheet, multiple work/division sheets, and one summary sheet (`SUM` or `MS`).
- Most work sheets use row 5 as the header row.
- Bill No. 1 general requirements uses row 7 on `Gen Req`; its `MS` sheet is a main summary rather than a normal item-entry sheet.
- Normal work-sheet columns are:
  - `A` / column 1: `ITEM`
  - `B` / column 2: `DESCRIPTION`
  - `C` / column 3: `QTY.`
  - `D` / column 4: `UNIT`
  - `E` / column 5: `RATE`
  - `F` / column 6: `AMOUNT`
- Summary sheets often map description and amount differently and must be preserved, not treated as normal item sheets.

## Description Style

Descriptions are concise and trade-specific. They often include dimensions, type codes, reference codes, or brief allowance wording:

- `50mm Blinding`
- `Mass concrete fill`
- `200mm insulated cavity wall with aluminum perforated steel, Ref; P10`
- `1100 x 2250mm, Type D3`
- `15mm thick Cement Plaster, Ref: PT-01`
- `Floor drain, 100mmL x 100mmW, Ref; FD-01`
- `Allow for loading dock bumpers and shelters/seals, including fixings and accessories; complete as per Drawings and Specifications.`

## Unit Style

The templates use BOQ units from the workbook, not only the original MVP tags:

- Common: `nr`, `m2`, `m`, `m3`, `item`
- Also present: `kg`
- Summary sheets include page references and `TBA`, which should not be interpreted as item units.

## Product Rule

For all future template profiles, the app should preserve the uploaded workbook structure and fill only description and unit cells. Quantity, rate, and amount must stay blank.
