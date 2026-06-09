# AI BOQ Agent

A Vercel-hosted Next.js app for AI-assisted BOQ description and unit drafting.

The app follows `AI_BOQ_Agent_Build_Plan.md` and the supplied U-View Excel BOQ templates. It is intentionally strict: the agent can draft descriptions and units only. Quantity, rate, and amount stay blank and locked.

## What Is Built

- Clerk-protected app shell with dashboard and project wizard.
- Neon Postgres schema for projects, files, rules, templates, BOQ items, revisions, queries, assumptions, jobs, notifications, activity, and AI usage.
- Vercel Blob direct-upload route for source documents, BOQ templates, and previous BOQs.
- Previous BOQ learning: uploaded past bills are analysed and stored as reusable
  house-style knowledge (description patterns, item wording, trade/section
  structure, headings, numbering, unit usage, measurement-standard usage,
  inclusions/exclusions, formatting, and summary/page structure). The agents read
  this knowledge when generating new drafts so the output matches your style.
- U-View BOQ template profile seed based on the supplied Bill No. 1 to Bill No. 8.4 workbooks.
- Template parser foundation for future BOQ formats.
- App-wide BOQ rule library (`/rules`): shared across all projects and organised
  by measurement-standard section (POMI GP/A–R, NRM2 1–41, NRM1 elements). Each
  rule can be assigned to a section (or left general); section agents read their
  own section's rules plus general rules. Moved out of the per-project workflow —
  rules are common to the app and depend only on the measurement method.
- Measurement-method-aware generation (POMI / NRM2 / NRM1 / Custom). Units are
  never guessed — they are checked against the selected method, the rule library,
  the uploaded documents, and the learned previous-BOQ patterns, or a query is raised.
- Generation queue screen and OpenRouter provider layer for MiniMax M3.
- BOQ review grid with inline edits, autosave actions, status filters, confidence badges, and locked blank quantity/rate/amount columns.
- Query register, assumption register, and a working Excel export.
- Excel export (ExcelJS): a formatted workbook with a BOQ sheet grouped by trade
  section (headings, descriptions, units; blank quantity/rate/amount columns),
  plus Summary/Collection, Assumptions, Queries (RFI), and an AI Review Notice
  sheet. Structure and summary layout follow the learned previous-BOQ style.
- App-wide knowledge base: previous BOQs are analysed by discipline scope and
  stored in `app_knowledge_base` (keyed by agent/scope/standard), reusable across
  ALL projects and every future generation — not project-bound.
- Multiple BOQ generations per project: every run is a separate, stored
  generation. BOQ items, queries, assumptions, agent logs and exports are all
  separated by `generation_id`; old generations are never overwritten. The
  Generate screen lists every generation with live per-agent status.
- Recycle Bin: projects and generations support soft delete (recoverable) and
  permanent delete (cascades all generation/project data and removes blobs).
  App-wide previous-BOQ knowledge is preserved on deletion.
- Measurement-standard section agents: POMI (17 section agents GP/A–R), NRM2
  (41 work-section agents), and NRM1 (elemental cost-plan agents, kept separate
  from detailed BOQ logic). Each agent generates only its own section/scope and
  reads the matching app-wide scope knowledge base.
- Automatic agent activation: the system detects which discipline scopes have
  uploaded documents and runs only the relevant section agents in parallel
  (bounded concurrency, configurable via `GENERATION_CONCURRENCY`). Agents whose
  scope has no documents are skipped with a reason (e.g. "Skipped — no Structural
  documents uploaded") and shown live on the Generate screen with per-agent and
  overall progress.
- Real-time pipeline agents: a BOQ QA Agent (removes duplicates and raises
  queries for missing units and missing source references) and an Excel Export
  Agent appear as live agents alongside the section agents. The Generate screen
  shows overall %, per-agent %, status (running/waiting/completed/skipped/
  failed) with counts and live status text, and an expandable processing log;
  it auto-refreshes while a generation is running.
- Knowledge base management screen: an app-wide Knowledge base page lists the
  learned records by discipline scope, with filters and per-record actions to
  approve, disable/enable, edit (all learned aspects), and delete. Disabled
  records are excluded from generation; approved records are preferred.
- App-wide previous-BOQ training: a dedicated `/knowledge-base/train` page
  uploads past bills independently of any project. Each is analysed by discipline
  scope and stored app-wide, reused by the agents on every project.
- Multi-model AI via OpenRouter: a central model router selects the model per
  task (classification, scope detection, previous-BOQ analysis, knowledge
  extraction, BOQ generation, unit checking, assumptions, queries, section-agent
  processing, final QA, export prep, testing) and quality mode (Economy /
  Balanced / Premium, chosen per generation). Roles: GLM 4.7 Flash (bulk),
  GLM 4.5 Air Free (testing), Gemini 2.5 Flash-Lite (main cheap BOQ model),
  MiniMax M3 (premium), Qwen3 Coder (optional). Fallback chain on failure, every
  call logged to `ai_model_usage_logs` with token/cost, and the active model
  shown per agent on the Generate screen. Configure model IDs and the default
  mode entirely via environment variables; review config and usage/cost at
  `/settings/ai`.

## Configure These Services

1. Create a Vercel project connected to this GitHub repo.
2. Add Clerk to the project and set:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`
3. Create a Neon Postgres database and set `DATABASE_URL`.
4. In Neon SQL editor, run:
   - `database/schema.sql`
   - `database/migration_previous_boq_knowledge.sql` (adds the `boq_knowledge`
     table on databases created before previous-BOQ learning; `schema.sql`
     already includes it for fresh installs)
   - `database/migration_foundation.sql` (app-wide knowledge base, multiple
     generations with `generation_id` separation, generation-scoped exports and
     agent logs, and Recycle Bin soft-delete; `schema.sql` already includes it
     for fresh installs)
   - `database/migration_ai_models.sql` (multi-model cost logging table,
     per-generation quality mode, and per-agent model display; also in
     `schema.sql` for fresh installs)
   - `database/migration_rule_sections.sql` (adds `section_code` to the app-wide
     rule library; also in `schema.sql` for fresh installs)
   - `database/seed_template_profiles.sql`
   - `database/seed_rules.sql`
5. Create/connect a Vercel Blob store and confirm `BLOB_READ_WRITE_TOKEN` is available in Vercel.
6. Create an OpenRouter API key and set:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL=minimax/minimax-m3` or the current MiniMax M3 model id shown in OpenRouter.
   - optional `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME`.
7. Deploy on Vercel.

## BOQ Template Support

The supplied Excel files follow a reusable profile:

- Work sheets usually use row 5 headers.
- Columns are typically `ITEM`, `DESCRIPTION`, `QTY.`, `UNIT`, `RATE`, `AMOUNT`.
- Summary/index sheets are preserved but not treated as item-entry sheets.
- Units are template-driven: `nr`, `item`, `m`, `m2`, `m3`, `kg`, etc.

Future templates should be added as records in `boq_template_profiles`, not hard-coded into screens.

## Local Development

You said local run/testing is not needed. For Vercel deployment, Vercel will install dependencies from `package.json` and build the Next.js app automatically.
