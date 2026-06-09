-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Data-model foundation
--   * App-wide (cross-project) previous-BOQ knowledge base, split per scope/agent
--   * Multiple BOQ generations per project, fully separated by generation_id
--   * Generation-scoped exports and per-agent run logs
--   * Recycle Bin (soft delete) for projects and generations
--
-- Additive and idempotent: safe to run on an existing database. Existing tables
-- and rows are preserved.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── App-wide previous BOQ uploads registry ──────────────────────────────────
-- A previous BOQ is uploaded once and its learned knowledge is reusable across
-- ALL projects. origin_project_id records where it was uploaded from (nullable)
-- so we can honour "delete app-wide knowledge only if it belonged solely to a
-- deleted project and the user confirms".
create table if not exists previous_boq_uploads (
  id uuid primary key default gen_random_uuid(),
  origin_project_id uuid references projects(id) on delete set null,
  file_id uuid references project_files(id) on delete set null,
  uploaded_by uuid references users(id) on delete set null,
  file_name text not null,
  storage_url text,
  measurement_standard text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'analyzing', 'analyzed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists previous_boq_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references previous_boq_uploads(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress integer not null default 0,
  current_step text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── App-wide, per-scope/per-agent knowledge base ────────────────────────────
-- One row per (agent/scope/section) learned from a previous BOQ. Reused by the
-- matching generation agents for every future project.
create table if not exists app_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,                 -- e.g. 'architectural', 'structural', 'mep-mechanical'
  scope text not null,                    -- e.g. 'Architectural', 'Internal Design', 'Structural'
  measurement_standard text,              -- POMI / NRM2 / NRM1 / Custom (nullable)
  section_code text,                      -- POMI 'J', NRM2 '24', etc. (nullable)
  upload_id uuid references previous_boq_uploads(id) on delete cascade,
  source_file_name text,
  -- Learned knowledge aspects
  description_patterns text,
  item_wording_patterns text,
  trade_section_structure text,
  heading_structure text,
  numbering_style text,
  unit_usage_patterns text,
  measurement_standard_usage text,
  scope_description_patterns text,
  inclusions text,
  exclusions text,
  summary_structure text,
  collection_structure text,
  cover_page_style text,
  excel_formatting_style text,
  column_structure text,
  client_company_style text,
  sample_items jsonb not null default '[]'::jsonb,
  detected_units jsonb not null default '[]'::jsonb,
  raw_analysis jsonb not null default '{}'::jsonb,
  confidence_score numeric(4, 2) not null default 0.70,
  status text not null default 'active'
    check (status in ('active', 'approved', 'disabled')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_knowledge_scope on app_knowledge_base(scope);
create index if not exists idx_app_knowledge_agent on app_knowledge_base(agent_id);
create index if not exists idx_app_knowledge_lookup
  on app_knowledge_base(scope, measurement_standard, section_code);

-- ── Multiple BOQ generations per project ────────────────────────────────────
create table if not exists boq_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  measurement_standard text not null,
  template_id uuid references boq_templates(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'completed', 'failed', 'exported')),
  source_file_ids jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  query_count integer not null default 0,
  assumption_count integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  created_by uuid references users(id) on delete set null,
  deleted_at timestamptz,                 -- recycle bin (soft delete)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boq_generations_project on boq_generations(project_id);
create index if not exists idx_boq_generations_active on boq_generations(project_id, deleted_at);

-- ── Generation_id on every generation output ────────────────────────────────
alter table boq_items add column if not exists generation_id uuid
  references boq_generations(id) on delete cascade;
alter table boq_queries add column if not exists generation_id uuid
  references boq_generations(id) on delete cascade;
alter table boq_assumptions add column if not exists generation_id uuid
  references boq_generations(id) on delete cascade;
alter table agent_jobs add column if not exists generation_id uuid
  references boq_generations(id) on delete cascade;

create index if not exists idx_boq_items_generation on boq_items(generation_id);
create index if not exists idx_boq_queries_generation on boq_queries(generation_id);
create index if not exists idx_boq_assumptions_generation on boq_assumptions(generation_id);
create index if not exists idx_agent_jobs_generation on agent_jobs(generation_id);

-- ── Generation-scoped exports ───────────────────────────────────────────────
create table if not exists boq_generation_exports (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references boq_generations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  storage_url text,
  format text not null default 'xlsx',
  item_count integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_boq_generation_exports_gen
  on boq_generation_exports(generation_id);

-- ── Per-agent run logs (powers real-time status + agent run history) ─────────
create table if not exists boq_generation_agent_logs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references boq_generations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  agent_id text not null,
  agent_label text not null,
  scope text,
  section_code text,
  status text not null default 'waiting'
    check (status in ('waiting', 'running', 'completed', 'skipped', 'failed')),
  progress integer not null default 0,
  status_text text,
  items_count integer not null default 0,
  queries_count integer not null default 0,
  assumptions_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_logs_generation on boq_generation_agent_logs(generation_id);

-- ── Recycle bin for projects ────────────────────────────────────────────────
alter table projects add column if not exists deleted_at timestamptz;
create index if not exists idx_projects_deleted_at on projects(deleted_at);

-- ── updated_at triggers for the new mutable tables ──────────────────────────
drop trigger if exists previous_boq_uploads_set_updated_at on previous_boq_uploads;
create trigger previous_boq_uploads_set_updated_at
before update on previous_boq_uploads
for each row execute function set_updated_at();

drop trigger if exists previous_boq_analysis_jobs_set_updated_at on previous_boq_analysis_jobs;
create trigger previous_boq_analysis_jobs_set_updated_at
before update on previous_boq_analysis_jobs
for each row execute function set_updated_at();

drop trigger if exists app_knowledge_base_set_updated_at on app_knowledge_base;
create trigger app_knowledge_base_set_updated_at
before update on app_knowledge_base
for each row execute function set_updated_at();

drop trigger if exists boq_generations_set_updated_at on boq_generations;
create trigger boq_generations_set_updated_at
before update on boq_generations
for each row execute function set_updated_at();

drop trigger if exists boq_generation_agent_logs_set_updated_at on boq_generation_agent_logs;
create trigger boq_generation_agent_logs_set_updated_at
before update on boq_generation_agent_logs
for each row execute function set_updated_at();
