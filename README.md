# AI BOQ Agent

A Vercel-hosted Next.js app for AI-assisted BOQ description and unit drafting.

The app follows `AI_BOQ_Agent_Build_Plan.md` and the supplied U-View Excel BOQ templates. It is intentionally strict: the agent can draft descriptions and units only. Quantity, rate, and amount stay blank and locked.

## What Is Built

- Clerk-protected app shell with dashboard and project wizard.
- Neon Postgres schema for projects, files, rules, templates, BOQ items, revisions, queries, assumptions, jobs, notifications, activity, and AI usage.
- Vercel Blob direct-upload route for source documents and BOQ templates.
- U-View BOQ template profile seed based on the supplied Bill No. 1 to Bill No. 8.4 workbooks.
- Template parser foundation for future BOQ formats.
- Rule library with editable unit/description rules.
- Generation queue screen and OpenRouter provider layer for MiniMax M3.
- BOQ review grid with inline edits, autosave actions, status filters, confidence badges, and locked blank quantity/rate/amount columns.
- Query register, assumption register, export preview, and setup page.

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
