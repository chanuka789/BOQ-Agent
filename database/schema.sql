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
