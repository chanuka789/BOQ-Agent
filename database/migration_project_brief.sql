-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: project understanding / coordination brief
--   * project_briefs stores the lead-coordinator reasoning output per generation:
--     project name, client, drawing register (with each drawing's scope), the
--     disciplines present, and the per-scope coverage plan used to coordinate the
--     section agents and to check for missed items.
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists project_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  generation_id uuid references boq_generations(id) on delete cascade,
  brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generation_id)
);

create index if not exists idx_project_briefs_project on project_briefs(project_id);

drop trigger if exists project_briefs_set_updated_at on project_briefs;
create trigger project_briefs_set_updated_at
before update on project_briefs
for each row execute function set_updated_at();
