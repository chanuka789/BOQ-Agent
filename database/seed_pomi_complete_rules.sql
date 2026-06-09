-- Complete POMI (Principles of Measurement - International) Rule Seed Script
-- Covers all sections GP to R.
-- Run this in the Neon SQL editor to seed standard measurement rules.

-- First, let's delete any duplicate/old POMI rules we are correcting
delete from boq_rules where measurement_standard = 'POMI' and trade = 'Partitions';

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
  -- SECTION GP & A: General Requirements
  ('POMI', 'General Requirements', 'Contractor facilities', 'Site admin & supervision offices', 'item', 'Describe size, fittings, duration, utility connections, and maintenance requirements.', 'Utility connection, cleaning, maintenance, furniture, internet.', 'Employer facilities.', false),
  ('POMI', 'General Requirements', 'Constructional plant', 'Heavy machinery mobilization', 'item', 'Describe type of plant, transport, erecting, maintaining, and dismantling at completion.', 'Transport, erecting, licensing, fuel, operating crew, dismantling.', 'Temporary works.', false),
  ('POMI', 'General Requirements', 'Temporary works', 'Scaffolding & access roads', 'item', 'Describe height range, locations, load capacities, access roads, and removal.', 'Erection, structural ties, safety nets, decking, maintenance, removal.', 'Permanent works.', false),
  ('POMI', 'General Requirements', 'Sundry items', 'Testing & completion cleaning', 'item', 'Describe testing requirements, standards, completion cleaning, and rubbish removal.', 'Sampling, laboratory fees, final polish, debris cartage.', 'Excavation disposal.', false),

  -- SECTION B: Site Work
  ('POMI', 'Site Work', 'Site exploration', 'Borehole drilling', 'm', 'State count, size, average depth, soil classification, and reporting requirements.', 'Casing, sampling, reporting, backfilling.', 'Trial holes.', false),
  ('POMI', 'Site Work', 'Site preparation', 'Clearance of topsoil', 'm2', 'State average depth, soil type, preservation requirements, and location.', 'Removing shrubs, grubbing roots, stockpiling topsoil.', 'Tree removal.', false),
  ('POMI', 'Site Work', 'Site preparation', 'Tree removal', 'nr', 'State girth range (e.g. 300-600mm), location, and root grubbing.', 'Cutting, root grubbing, filling hole, disposal.', 'Topsoil clearance.', false),
  ('POMI', 'Site Work', 'Excavation', 'Reduce levels excavation', 'm3', 'Describe soil/rock class, depth zone, disposal destination, and support details.', 'Excavating, dewatering, earthwork support, loading.', 'Backfilling and disposal.', false),
  ('POMI', 'Site Work', 'Excavation', 'Service trenching', 'm', 'Describe pipe/cable size, average depth, soil type, and backfill/compact details.', 'Excavating, earthwork support, backfilling, compacting.', 'Bulk excavation.', false),
  ('POMI', 'Site Work', 'Driven piling', 'Piling supply & drive', 'm', 'State pile size, material, concrete grade, reinforcing, driven depth, and count.', 'Pile shoe, reinforcement, driving to refusal, cutting head.', 'Piling tests.', false),
  ('POMI', 'Site Work', 'Underground drainage', 'Drainage pipework', 'm', 'Describe pipe material, class, internal diameter, bedding type, jointing, and depth.', 'Excavation, bedding, jointing, backfilling, testing.', 'Manholes (Nr).', false),
  ('POMI', 'Site Work', 'Paving and surfacing', 'Roadway paving', 'm2', 'Describe sub-base, base course, thickness, tarmac/concrete details, and joints.', 'Sub-grade prep, base compaction, paving layers, borders.', 'Curbs and gutters.', false),

  -- SECTION C: Concrete Work
  ('POMI', 'Concrete Work', 'Poured concrete', 'Foundations & beds', 'm3', 'State concrete grade, aggregate size, thickness (for beds), and placing location.', 'Mixing, placing, compacting, curing.', 'Formwork (m2) and reinforcement (t).', false),
  ('POMI', 'Concrete Work', 'Poured concrete', 'Suspended slabs & beams', 'm3', 'State grade, span, thickness, elevation, and structural classification.', 'Placing, vibrating, curing, finishing.', 'Formwork (m2), prestressing.', false),
  ('POMI', 'Concrete Work', 'Reinforcement', 'Bar reinforcement', 't', 'State material type, grade, size/diameter range, and location details.', 'Bending, cutting, fixing, tie wire, spacers.', 'Fabric reinforcement (m2).', false),
  ('POMI', 'Concrete Work', 'Reinforcement', 'Fabric reinforcement', 'm2', 'State mesh type, weight per m2, laps, and structural location.', 'Spacers, ties, cutting, placing.', 'Lap additions.', false),
  ('POMI', 'Concrete Work', 'Shuttering', 'Contact formwork', 'm2', 'Describe elements (walls, columns, soffits), height limits, and release agents.', 'Erection, propping, releasing, cleaning, striking.', 'Grooves under 2500 mm2.', false),

  -- SECTION D: Masonry
  ('POMI', 'Masonry', 'Masonry walls', 'Blockwork partitions', 'm2', 'Describe block size, thickness, material, mortar mix, reinforcement, and fair face.', 'Mortar, ties, lintel beddings, jointing.', 'Plastering or finishes.', false),
  ('POMI', 'Masonry', 'Masonry trims', 'Sills and copings', 'm', 'Describe size, profile, material, fixing, jointing, and water drip detailing.', 'Bedding, pointing, reinforcement, dowels.', 'Cavity filling.', false),

  -- SECTION E: Metalwork
  ('POMI', 'Metalwork', 'Structural metalwork', 'Stanchions & beams', 't', 'State steel grade, profile types, connection types (welded/bolted), and priming.', 'Connections, plates, cleats, shop priming, bolts.', 'Grouting bases (Nr).', false),
  ('POMI', 'Metalwork', 'Non-structural metalwork', 'Handrails & balustrades', 'm', 'Describe profile sizes, material, mounting method, finish, and drawing ref.', 'Standards, rails, brackets, fixings, painting.', 'Gates (Nr).', false),

  -- SECTION F: Woodwork & Joinery
  ('POMI', 'Architecture + Internal Design', 'Woodwork', 'Structural timbers', 'm', 'State basic and finished dimensions, sawn/finished classification, and location.', 'Fixings, joints, framing, preservative treatment.', 'Grounds and battens.', false),
  ('POMI', 'Architecture + Internal Design', 'Woodwork', 'Boarding and flooring', 'm2', 'State material, thickness, fixing method, profile (T&G), and area classification.', 'Fixings, joints, sanding, initial sealing.', 'Fascia and verges (m).', false),
  ('POMI', 'Architecture + Internal Design', 'Woodwork', 'Woodwork trims', 'm', 'Describe skirtings, architraves, picture rails, nosings, profile, and fixing.', 'Mitres, fixing pins, adhesive.', 'Cabinets and joinery (Nr).', false),
  ('POMI', 'Architecture + Internal Design', 'Woodwork', 'Composite joinery', 'nr', 'Describe fitment, carcass, fronts, dimensions, finish, hardware, and drawing ref.', 'Drawers, shelves, locks, hinges, handles, ironmongery.', 'Quantities.', false),

  -- SECTION G: Thermal & Moisture Protection
  ('POMI', 'Architecture + Internal Design', 'Waterproofing', 'Waterproofing coverings', 'm2', 'Describe membrane material, substrate prep, orientation (flat/sloping), and protection.', 'Substrate primer, overlap seams, upstands, protective screed.', 'Skirtings/flashings (m).', false),
  ('POMI', 'Architecture + Internal Design', 'Waterproofing', 'Damp-proof courses', 'm', 'Describe DPC material, width, laps, bedding, and location.', 'Bedding mortar, lap joints.', 'Tanking membrane.', false),
  ('POMI', 'Architecture + Internal Design', 'Waterproofing', 'Insulation boards', 'm2', 'Describe board material, thickness, density, fixing adhesive/pins, and location.', 'Adhesive, joint tape, mechanical fixings.', 'Slabs or structural screeds.', false),

  -- SECTION H: Doors & Windows
  ('POMI', 'Architecture + Internal Design', 'Doors', 'Door sets', 'nr', 'Describe door type, leaf structure, frame details, finish, fire rating, and locks.', 'Door leaf, frame, hinges, locksets, closers, seals, architraves.', 'Glazing to doors.', false),
  ('POMI', 'Architecture + Internal Design', 'Windows', 'Windows and skylights', 'nr', 'Describe window frame, material, finish, glazing details, hardware, and count.', 'Frames, sashes, ironmongery, seals, weather-bars.', 'Glazed screens.', false),
  ('POMI', 'Architecture + Internal Design', 'Windows', 'Glazed screens', 'm2', 'Describe screen structure, frame profiles, glazing details, fire rating, and drawing.', 'Frames, gaskets, glazing beads, sealants.', 'Doors within screens (Nr).', false),
  ('POMI', 'Architecture + Internal Design', 'Windows', 'Glass sheets', 'm2', 'Describe glass type, thickness, mounting method (bead/putty), and frame location.', 'Beads, gaskets, putties, spacers.', 'Louvres (Nr).', false),

  -- SECTION J: Finishes & Decorations
  ('POMI', 'Architecture + Internal Design', 'Finishes', 'Plastering and screeds', 'm2', 'State substrate, mix, backing coats, finish coat, thickness, and location.', 'Bonding agents, corner beads, trowel finishing.', 'Skirtings and mouldings (m).', false),
  ('POMI', 'Architecture + Internal Design', 'Finishes', 'Suspended ceilings', 'm2', 'Describe grid system, tile size, drop height range, and acoustic properties.', 'Grid, hangers, border trim, access panels.', 'Luminaire cut-outs.', false),
  ('POMI', 'Architecture + Internal Design', 'Painting', 'Decorative paint finish', 'm2', 'Describe paint system, substrate, coats count, sheen, and surface type.', 'Primer, prep, undercoats, protective coatings.', 'Small pipes (m).', false),
  ('POMI', 'Architecture + Internal Design', 'Painting', 'Pipe painting', 'm', 'State pipe external diameter range, paint system, substrate, and location.', 'Cleaning, primer, coats, prep.', 'Hangers.', false),

  -- SECTION K: Accessories
  ('POMI', 'Architecture + Internal Design', 'Partitions', 'Drywall partitions', 'm', 'Describe drywall width, studs, board types, insulation, height, and finish.', 'Metal studs, insulation, boards, taping, joints.', 'Doors and glass inserts (Nr).', false),
  ('POMI', 'Architecture + Internal Design', 'Partitions', 'Toilet/shower cubicles', 'nr', 'Describe cubicle material (HPL), size, pilasters, doors, and hardware.', 'Panel boards, posts, brackets, locks, hinges.', 'Screeds/plastering.', false),

  -- SECTION L, M & N: Equipment, Furnishings & Special
  ('POMI', 'Equipment', 'Equipment', 'Specialist functional equipment', 'nr', 'Describe equipment model, manufacturer, size, connections, and mounting.', 'Utility connectors, brackets, initial testing.', ' Loose items.', false),
  ('POMI', 'Furnishings', 'Furnishings', 'Curtain track system', 'm', 'Describe track profile, mounting method, cord control, and accessories.', 'Gliders, hooks, stops, brackets.', 'Curtains (Nr).', false),

  -- SECTION P: Conveying Systems
  ('POMI', 'Conveying Systems', 'Conveying', 'Lifts and escalators', 'nr', 'Describe passenger capacity, speed, stops, shaft dimensions, and electrical loads.', 'Cabin, motors, ropes, control panels, initial testing.', 'Structural shaft walls.', false),

  -- SECTION Q: Mechanical Installations
  ('POMI', 'Mechanical Engineering', 'Pipework', 'Mechanical pipe system', 'm', 'Describe pipe material, joint type, insulation, and diameter (ID ≤ 60mm).', 'Small fittings, inline valves, joints, hangers.', 'Large fittings (Nr).', false),
  ('POMI', 'Mechanical Engineering', 'Ductwork', 'Rectangular ductwork', 't', 'Describe material, gauge, thickness, joints, support system, and girth.', 'Flanges, supports, seams, dampers.', 'Circular ductwork (m).', false),
  ('POMI', 'Mechanical Engineering', 'Ductwork', 'Circular ductwork', 'm', 'Describe diameter, material, joints, supports, and routing.', 'Flanges, supports, joints.', 'Dampers (Nr).', false),

  -- SECTION R: Electrical Installations
  ('POMI', 'Electrical Engineering', 'Wiring systems', 'Cable conduit & trunking', 'm', 'Describe conduit size, material, mounting type (surface/concealed), and cabling.', 'Conduit, boxes, fittings, pull wires.', 'Termination points (Nr).', false),
  ('POMI', 'Electrical Engineering', 'Termination points', 'Final sub-circuit points', 'nr', 'State type (lighting, switch, socket, cooker), current rating, and box details.', 'Besa box, grid plates, switch inserts.', 'Cabling and conduits (m).', false)
on conflict (measurement_standard, scope, trade, item_type, unit) do update set
  description_rule = excluded.description_rule,
  inclusions = excluded.inclusions,
  exclusions = excluded.exclusions,
  updated_at = now();
