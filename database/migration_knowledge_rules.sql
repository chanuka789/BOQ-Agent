-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: previous BOQ analysis visibility + knowledge→rules link
--   * previous_boq_uploads.error_message — surface analysis failures in the UI.
-- Approving a knowledge record synthesises BOQ rules into the app-wide rule
-- library (no schema change needed for that — it reuses boq_rules).
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table previous_boq_uploads add column if not exists error_message text;
