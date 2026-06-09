-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Multi-model AI (OpenRouter model routing) support
--   * ai_model_usage_logs — per-call cost/usage logging across tasks & models
--   * boq_generations.quality_mode — economy / balanced / premium per generation
--   * boq_generation_agent_logs.model_name — show the active model per agent
-- Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

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
