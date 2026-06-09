-- Starter Architecture + Internal Design BOQ rules.
-- These are drafting seeds only. A qualified QS must verify them before use.

insert into boq_rules (
  measurement_standard,
  scope,
  trade,
  item_type,
  unit,
  description_rule,
  inclusions,
  exclusions,
  verified_by_qs
)
values
  ('POMI', 'Architecture + Internal Design', 'Doors', 'Single leaf door set', 'nr', 'Describe door type, size, frame, finish, fire rating, ironmongery set, and location reference.', 'Frame, architraves, hinges, locks, closers, seals where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Windows', 'Internal glazed screen/window', 'm2', 'Describe glazing type, frame material, thickness/performance, finish, and drawing reference.', 'Frames, beads, gaskets, sealants where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Partitions', 'Drywall partition', 'm2', 'Describe partition type, board layers, studs, insulation, height, fire/acoustic rating, and finish readiness.', 'Stud framing, boards, insulation, trims, jointing where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Wall finishes', 'Wall tiling/finish', 'm2', 'Describe substrate, finish material, size/thickness, pattern, grout, accessories, and room/reference.', 'Adhesive, grout, trims, preparation where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Floor finishes', 'Floor finish', 'm2', 'Describe floor finish material, thickness, backing, fixing method, skirting interface, and area reference.', 'Adhesive, underlay, trims, floor preparation where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Ceiling finishes', 'Suspended ceiling', 'm2', 'Describe ceiling type, tile/board size, suspension system, access panels, height, finish, and room reference.', 'Grid, hangers, perimeter trims, access panels where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Skirting', 'Skirting', 'm', 'Describe skirting material, height, profile, finish, fixing, and room/reference.', 'Fixings, mitres, sealant where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Painting', 'Paint finish', 'm2', 'Describe substrate, paint system, number of coats, sheen, preparation, and location.', 'Primer, undercoats, finishing coats, preparation where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Waterproofing', 'Waterproofing membrane', 'm2', 'Describe membrane type, substrate, laps, upstands, protection, and wet area reference.', 'Primers, tapes, upstands, collars where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Joinery', 'Bespoke joinery item', 'nr', 'Describe joinery type, dimensions, carcass, finish, hardware, accessories, and drawing reference.', 'Carcass, fronts, shelves, hardware, edging where specified.', 'Quantities, rates, and amounts.', false),
  ('POMI', 'Architecture + Internal Design', 'Ironmongery', 'Ironmongery set', 'nr', 'Describe ironmongery set, finish, door reference, security/access control requirements, and schedule reference.', 'Hinges, locks, handles, closers, stops, seals where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Doors', 'Door set', 'nr', 'Describe door set by type, size, material, frame, finish, fire rating, acoustic rating, ironmongery, and reference.', 'Door leaf, frame, architraves, ironmongery, seals where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Windows', 'Glazed screen/window', 'm2', 'Describe glazed screen/window by frame, glazing, performance, finish, and source reference.', 'Frames, glazing, beads, gaskets, sealants where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Partitions', 'Partition system', 'm2', 'Describe partition system by build-up, thickness, height, board layers, insulation, fire/acoustic rating, and finish.', 'Framing, boards, insulation, trims, jointing where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Wall finishes', 'Wall finish', 'm2', 'Describe finish type, substrate, material, size, finish code, accessories, and location.', 'Preparation, adhesive, grout, trims, sealants where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Floor finishes', 'Floor finish', 'm2', 'Describe material, thickness, format, fixing, backing/underlay, finish code, and room reference.', 'Preparation, adhesive, underlay, trims where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Ceiling finishes', 'Ceiling system', 'm2', 'Describe ceiling system, board/tile, grid, suspension, access panels, height, finish, and reference.', 'Grid, hangers, trims, access panels where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Skirting', 'Skirting', 'm', 'Describe skirting by material, height, profile, finish, fixing method, and room/reference.', 'Fixings, mitres, sealant where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Painting', 'Decorative painting', 'm2', 'Describe substrate, preparation, primer, coating system, number of coats, sheen, colour/reference, and location.', 'Preparation, primer, undercoats, finishing coats where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Waterproofing', 'Liquid/sheet waterproofing', 'm2', 'Describe waterproofing type, substrate, laps, upstands, protection, testing requirements, and area reference.', 'Primers, tapes, collars, upstands where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Joinery', 'Fitted furniture/joinery', 'nr', 'Describe fitted item, dimensions, carcass, fronts, worktops, finish, hardware, services interfaces, and drawing reference.', 'Carcass, fronts, shelves, hardware, edging, worktops where specified.', 'Quantities, rates, and amounts.', false),
  ('NRM2', 'Architecture + Internal Design', 'Ironmongery', 'Ironmongery set', 'nr', 'Describe ironmongery set by door reference, function, finish, access/security requirements, and schedule reference.', 'Hinges, locks, handles, closers, stops, seals where specified.', 'Quantities, rates, and amounts.', false)
on conflict do nothing;
