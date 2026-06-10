-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: three-layer document intelligence
--   * document_chunks gains discipline/section/standard/trade/reference columns
--     so classified, taggable chunks can be retrieved per agent.
--   * document_schedules stores structured schedule records (doors, windows,
--     finishes, etc.) parsed from uploaded documents.
-- Additive and idempotent. The existing embedding column is kept for future RAG.
-- ─────────────────────────────────────────────────────────────────────────────

alter table document_chunks add column if not exists discipline text;
alter table document_chunks add column if not exists section_code text;
alter table document_chunks add column if not exists measurement_standard text;
alter table document_chunks add column if not exists trade text;
alter table document_chunks add column if not exists drawing_ref text;
alter table document_chunks add column if not exists revision_ref text;
alter table document_chunks add column if not exists source_file_name text;
alter table document_chunks add column if not exists char_count integer;

create index if not exists idx_document_chunks_scope
  on document_chunks(project_id, scope, section_code);
create index if not exists idx_document_chunks_file on document_chunks(file_id);

create table if not exists document_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_id uuid references project_files(id) on delete cascade,
  schedule_type text not null,        -- door | window | finishes | sanitary | lighting | equipment | room_data | other
  scope text,
  discipline text,
  drawing_ref text,
  page_number integer,
  source_file_name text,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_schedules_project on document_schedules(project_id, scope);
create index if not exists idx_document_schedules_file on document_schedules(file_id);
