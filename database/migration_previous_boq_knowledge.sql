-- Migration: Previous BOQ learning
-- Adds the boq_knowledge table that stores the QS style/structure patterns
-- extracted from uploaded previous BOQs. The AI agents read these patterns
-- when generating a new BOQ so the output matches the firm's house style.
--
-- Run this in the Neon SQL editor on existing databases. New installs get the
-- same definition from schema.sql.

create extension if not exists pgcrypto;

create table if not exists boq_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_id uuid references project_files(id) on delete set null,
  source_file_name text,
  measurement_standard text,
  -- The ten learned BOQ knowledge aspects (stored as readable text so they
  -- can be injected straight into a generation prompt).
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
  -- Supporting structured data used for prompts and the Excel export.
  sample_items jsonb not null default '[]'::jsonb,
  detected_units jsonb not null default '[]'::jsonb,
  raw_analysis jsonb not null default '{}'::jsonb,
  status text not null default 'analyzed' check (status in ('pending', 'analyzing', 'analyzed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boq_knowledge_project_id on boq_knowledge(project_id);
create index if not exists idx_boq_knowledge_file_id on boq_knowledge(file_id);

drop trigger if exists boq_knowledge_set_updated_at on boq_knowledge;
create trigger boq_knowledge_set_updated_at
before update on boq_knowledge
for each row execute function set_updated_at();
