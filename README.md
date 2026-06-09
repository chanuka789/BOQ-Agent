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
- Rule library with editable unit/description rules.
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
