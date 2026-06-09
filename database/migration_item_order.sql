-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: stable BOQ item ordering
--   * boq_items.position — preserves the generated order within a section so the
--     "heading -> description -> lettered items (A, B, C…)" structure is kept on
--     screen and in the Excel export (item_no alone cannot order it, because
--     headings and descriptions share item_no '-').
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table boq_items add column if not exists position bigserial;

create index if not exists idx_boq_items_order
  on boq_items(project_id, generation_id, section, position);
