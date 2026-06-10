-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: live agent reasoning stream
--   * boq_generation_thoughts is an append-only feed of the coordinator and
--     agents' audit-safe decision/status notes, shown live on the Generate screen while a BOQ
--     is being generated.
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists boq_generation_thoughts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references boq_generations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  agent_id text not null,
  agent_label text not null,
  phase text,                       -- coordinator | section | qa | export
  kind text not null default 'thought',  -- thought | reasoning | status
  thought text not null,
  seq bigserial,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_thoughts_generation
  on boq_generation_thoughts(generation_id, seq);
