-- AI BOQ Agent Neon schema
-- Run this file in the Neon SQL editor before deploying the app.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text not null,
  project_type text not null default 'Commercial fit-out',
  scope text not null default 'Architecture + Internal Design',
  measurement_standard text not null check (measurement_standard in ('POMI', 'NRM2', 'NRM1', 'Custom')),
  status text not null default 'setup' check (
    status in (
      'setup',
      'documents_uploaded',
      'processing',
      'ready_for_generation',
      'ready_for_review',
      'exported'
    )
  ),
  confidence_threshold numeric(4, 2) not null default 0.72,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'reviewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  file_name text not null,
  file_type text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  storage_url text not null,
  document_type text,
  scope text,
  classification_confidence numeric(4, 2),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'classifying', 'classified', 'processing', 'indexed', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists boq_template_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  header_aliases jsonb not null default '{}'::jsonb,
  detection_rules jsonb not null default '{}'::jsonb,
  column_mapping jsonb not null default '{}'::jsonb,
  item_style_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists boq_rules (
  id uuid primary key default gen_random_uuid(),
  measurement_standard text not null check (measurement_standard in ('POMI', 'NRM2', 'NRM1', 'Custom')),
  section_code text,
  scope text not null,
  trade text not null,
  item_type text not null,
  unit text not null,
  description_rule text not null,
  inclusions text,
  exclusions text,
  verified_by_qs boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (measurement_standard, scope, trade, item_type, unit)
);
create index if not exists idx_boq_rules_section on boq_rules(measurement_standard, section_code);

create table if not exists boq_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_id uuid references project_files(id) on delete set null,
  profile_id uuid references boq_template_profiles(id) on delete set null,
  template_name text,
  template_kind text not null default 'boq',
  sheet_name text,
  header_row integer,
  description_column text,
  unit_column text,
  quantity_column text,
  rate_column text,
  amount_column text,
  numbering_style text,
  parsed_structure jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_id uuid references project_files(id) on delete cascade,
  page_number integer,
  chunk_index integer not null,
  document_type text,
  scope text,
  section text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists boq_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_id uuid references project_files(id) on delete set null,
  source_file_name text,
  measurement_standard text,
  description_patterns text,
  item_wording_patterns text,
  trade_section_structure text,
  heading_structure text,
  numbering_style text,
  unit_usage_patterns text,
  measurement_standard_usage text,
  inclusions text,
  exclusions text,
  formatting_style text,
  summary_structure text,
  sample_items jsonb not null default '[]'::jsonb,
  detected_units jsonb not null default '[]'::jsonb,
  raw_analysis jsonb not null default '{}'::jsonb,
  status text not null default 'analyzed' check (status in ('pending', 'analyzing', 'analyzed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_no text,
  section text not null default 'Architecture + Internal Design',
  trade text not null,
  item_type text not null,
  description text not null,
  unit text not null,
  quantity numeric,
  rate numeric,
  amount numeric,
  source_reference text,
  confidence_score numeric(4, 2) not null default 0.5,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'needs_review', 'approved', 'rejected', 'revised')
  ),
  ai_generated boolean not null default true,
  duplicate_group text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boq_items_quantity_blank check (quantity is null),
  constraint boq_items_rate_blank check (rate is null),
  constraint boq_items_amount_blank check (amount is null)
);

create table if not exists boq_assumptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  boq_item_id uuid references boq_items(id) on delete set null,
  assumption text not null,
  source_reference text,
  created_at timestamptz not null default now()
);

create table if not exists boq_queries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  boq_item_id uuid references boq_items(id) on delete set null,
  issue text not null,
  clarification_needed text not null,
  source_reference text,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_step text,
  message text,
  error_message text,
  estimated_cost_usd numeric(10, 4),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists boq_item_revisions (
  id uuid primary key default gen_random_uuid(),
  boq_item_id uuid not null references boq_items(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  edited_by uuid references users(id) on delete set null,
  old_values jsonb not null,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists boq_corrections (
  id uuid primary key default gen_random_uuid(),
  boq_item_id uuid references boq_items(id) on delete set null,
  project_id uuid not null references projects(id) on delete cascade,
  corrected_by uuid references users(id) on delete set null,
  original_description text,
  corrected_description text,
  original_unit text,
  corrected_unit text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  agent_job_id uuid references agent_jobs(id) on delete set null,
  provider text not null default 'OpenRouter',
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_members_user_id on project_members(user_id);
create index if not exists idx_project_files_project_id on project_files(project_id);
create index if not exists idx_document_chunks_project_id on document_chunks(project_id);
create index if not exists idx_document_chunks_embedding on document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_boq_template_profiles_active on boq_template_profiles(is_active);
create index if not exists idx_boq_rules_lookup on boq_rules(measurement_standard, scope, trade, item_type);
create index if not exists idx_boq_knowledge_project_id on boq_knowledge(project_id);
create index if not exists idx_boq_knowledge_file_id on boq_knowledge(file_id);
create index if not exists idx_boq_items_project_id on boq_items(project_id);
create index if not exists idx_boq_items_review_status on boq_items(project_id, review_status);
create index if not exists idx_boq_queries_project_id on boq_queries(project_id);
create index if not exists idx_boq_assumptions_project_id on boq_assumptions(project_id);
create index if not exists idx_agent_jobs_project_id on agent_jobs(project_id);
create index if not exists idx_activity_log_project_id on activity_log(project_id);
create index if not exists idx_ai_usage_project_id on ai_usage(project_id);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
before update on projects
for each row execute function set_updated_at();

drop trigger if exists project_files_set_updated_at on project_files;
create trigger project_files_set_updated_at
before update on project_files
for each row execute function set_updated_at();

drop trigger if exists boq_rules_set_updated_at on boq_rules;
create trigger boq_rules_set_updated_at
before update on boq_rules
for each row execute function set_updated_at();

drop trigger if exists boq_template_profiles_set_updated_at on boq_template_profiles;
create trigger boq_template_profiles_set_updated_at
before update on boq_template_profiles
for each row execute function set_updated_at();

drop trigger if exists boq_templates_set_updated_at on boq_templates;
create trigger boq_templates_set_updated_at
before update on boq_templates
for each row execute function set_updated_at();

drop trigger if exists boq_knowledge_set_updated_at on boq_knowledge;
create trigger boq_knowledge_set_updated_at
before update on boq_knowledge
for each row execute function set_updated_at();

drop trigger if exists boq_items_set_updated_at on boq_items;
create trigger boq_items_set_updated_at
before update on boq_items
for each row execute function set_updated_at();

drop trigger if exists boq_queries_set_updated_at on boq_queries;
create trigger boq_queries_set_updated_at
before update on boq_queries
for each row execute function set_updated_at();

drop trigger if exists agent_jobs_set_updated_at on agent_jobs;
create trigger agent_jobs_set_updated_at
before update on agent_jobs
for each row execute function set_updated_at();


-- ===========================================================================
-- Data-model foundation (also available standalone in migration_foundation.sql)
-- ===========================================================================
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
  error_message text,
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


-- ===========================================================================
-- Multi-model AI support (also in migration_ai_models.sql)
-- ===========================================================================
create table if not exists ai_model_usage_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  generation_id uuid references boq_generations(id) on delete set null,
  agent_id text,
  task_type text not null,
  model_name text not null,
  quality_mode text,
  attempt integer not null default 1,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  status text not null default 'success' check (status in ('success', 'failed')),
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_model_usage_generation on ai_model_usage_logs(generation_id);
create index if not exists idx_ai_model_usage_project on ai_model_usage_logs(project_id);
create index if not exists idx_ai_model_usage_created on ai_model_usage_logs(created_at);

alter table boq_generations
  add column if not exists quality_mode text not null default 'balanced'
  check (quality_mode in ('economy', 'balanced', 'premium'));

alter table boq_generation_agent_logs
  add column if not exists model_name text;
