-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: app-wide rule library organised by measurement-standard section
--   * boq_rules.section_code — POMI section (C, D, J, …) or NRM2 work section
--     (1–41). NULL means the rule is general and applies to every section of its
--     measurement standard. Rules remain app-wide and keyed by measurement
--     standard, not by project.
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table boq_rules add column if not exists section_code text;

create index if not exists idx_boq_rules_section
  on boq_rules(measurement_standard, section_code);
