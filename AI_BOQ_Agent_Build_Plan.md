# AI BOQ Drafting Agent — Complete Build Plan

**A browser-first, AI-assisted development guide**
*for a Quantity Surveying BOQ description & unit generation co-pilot*

- **Scope:** Architecture + Internal Design (MVP)
- **Primary AI model:** MiniMax M3
- **Stack:** Next.js + Neon Postgres + Vercel
- **Built entirely in the browser — no software installation required**

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [How to use this plan](#2-how-to-use-this-plan)
3. [Part 1: Your constraint-friendly toolkit](#3-part-1-your-constraint-friendly-toolkit)
4. [Part 2: The AI-assisted development method](#4-part-2-the-ai-assisted-development-method)
5. [Part 3: The complete feature set](#5-part-3-the-complete-feature-set)
6. [Part 4: Technical architecture](#6-part-4-technical-architecture)
7. [Part 5: Database schema](#7-part-5-database-schema)
8. [Part 6: UI and UX design plan](#8-part-6-ui-and-ux-design-plan)
9. [Part 7: The phase-by-phase build plan](#9-part-7-the-phase-by-phase-build-plan)
10. [Part 8: Testing and quality](#10-part-8-testing-and-quality)
11. [Part 9: Deployment and launch](#11-part-9-deployment-and-launch)
12. [Part 10: Risk management and cost control](#12-part-10-risk-management-and-cost-control)
13. [Appendix A: Ready-to-use prompts for Claude](#13-appendix-a-ready-to-use-prompts-for-claude)
14. [Appendix B: Pre-launch checklist](#14-appendix-b-pre-launch-checklist)
15. [Appendix C: Glossary](#15-appendix-c-glossary)

---

## 1. Executive summary

This document is a complete, step-by-step plan to build the AI BOQ Drafting Agent. It is written so you can build the whole app from a web browser, using AI tools to write most of the code, without installing software on your office laptop.

The product is a **co-pilot for Quantity Surveyors**. It reads uploaded project documents (specifications, schedules, drawings, templates) and produces a BOQ draft with correct item descriptions, correct units, source references, assumptions, and a query register. It does **not** calculate quantities, rates, or amounts. Those fields stay blank for the QS to complete.

### 1.1 What this plan adds to your original brief

Your original brief was strong. This plan keeps all of it and adds the improvements we agreed, plus extra features that a senior product team would expect. The headline additions are:

- **Authentication from day one** (Clerk) — so the app is safe to deploy from the first phase.
- **One AI gateway (OpenRouter)** in front of MiniMax M3 — so you can switch models with one setting and never hard-code a provider.
- **New database tables** for revision history, team members, QS corrections, notifications, and an activity log.
- **A full UI/UX design system** — colours, typography, components, page layouts, and the "trust layer" that shows every item is AI-generated and needs review.
- **Productivity features for the QS** — inline editing with autosave, bulk approve, search and filter, confidence colour-coding, clickable source links, and keyboard shortcuts.
- **An AI cost meter** — so you can see how much each generation costs and avoid surprise bills.

> **The one rule that never changes**
> The agent generates descriptions and units only. Quantity, rate, and amount must always remain blank. This appears in every prompt, every screen, and the exported file.

---

## 2. How to use this plan

Read the plan in order once, then keep it open as a reference while you build. The structure is:

1. **Part 1 — Your toolkit.** The browser-only tools that remove the need to install anything.
2. **Part 2 — The AI method.** How to use Claude (and others) to write the code for you.
3. **Part 3 — Features.** The full list of what the app does.
4. **Part 4 — Architecture.** How the system fits together.
5. **Part 5 — Database.** All the tables and their purpose.
6. **Part 6 — UI/UX design.** The look, feel, and every screen.
7. **Part 7 — Build phases.** The detailed, ordered steps with ready-to-use AI prompts.
8. **Parts 8–10 — Testing, launch, risk and cost.**
9. **Appendices —** copy-paste prompts, a launch checklist, and a glossary.

> **A note on uncertainty**
> Two facts in this plan should be verified before you rely on them, because they change over time and could not be fully confirmed here:
> 1. The exact MiniMax model name and that its API is reachable from your region. Confirm on the MiniMax / OpenRouter websites.
> 2. The current free-tier limits of GitHub Codespaces, Neon, and Vercel. The figures quoted were accurate in mid-2026 but you should re-check them when you sign up.

---

## 3. Part 1: Your constraint-friendly toolkit

You said you cannot install many things on your office laptop. Good news: the entire stack in your brief can be built and run inside a web browser. You only need a modern browser (Chrome or Edge) and internet access. Below is the toolkit, what each tool does, and why it fits your constraint.

### 3.1 The browser-only toolkit

| Tool | What it does | Why it fits (no install) | Cost to start |
|------|--------------|--------------------------|---------------|
| GitHub (account) | Stores your code; the home base for everything. | 100% web-based. | Free |
| GitHub Codespaces | A full code editor (VS Code) plus a computer in the cloud. Runs your app while you build. | Opens in a browser tab. Node.js and the terminal are already installed in the cloud, not on your laptop. | Free tier: 120 core-hours/month (about 60 hours on the standard machine) + 15 GB storage. Verify at signup. |
| Claude (claude.ai) | Writes code, explains errors, plans features. Your main AI developer. | Web-based chat. | Free / Pro |
| v0.dev (by Vercel) | Generates React + Tailwind UI from a text description or screenshot. | Web-based. | Free tier |
| Neon | Your Postgres database with pgvector for search. | Managed in the browser console. One reviewer noted you can do all daily tasks without installing anything. | Free tier: ~0.5 GB storage, 100 compute-hours/month, no card needed. Verify. |
| Vercel | Hosts the live app. Connects to GitHub and deploys automatically. | Web dashboard; deploys from your GitHub repo. | Free Hobby tier. Verify limits. |
| File storage (Vercel Blob, AWS S3, or Cloudflare R2) | Stores the large uploaded PDFs and Excel files. | Set up via web dashboards. | Free tier available |
| Inngest or Trigger.dev | Runs long background jobs (document processing, AI workflows) outside the web server. | Cloud service, configured in the browser. | Free tier |
| OpenRouter | One API that reaches MiniMax M3 and many other models. | Web dashboard for keys and usage. | Pay per use; small top-up |

### 3.2 Why Codespaces is the key that unlocks everything

The normal way to build a Next.js app is to install Node.js, a code editor, and Git on your computer. You cannot do that. GitHub Codespaces solves this completely: it gives you a real computer in the cloud, with all of that already installed, and you control it through a browser tab that looks and works exactly like the VS Code editor. When you run the app, it runs on the cloud machine and shows you a preview link. Nothing touches your office laptop except the browser.

> **Codespaces tip — protect your free hours**
> Free hours are counted while a Codespace is running or even "suspended". Always stop your Codespace when you finish for the day (not just close the tab). Delete old Codespaces you no longer need, because stored ones use your 15 GB storage quota.

### 3.3 Account setup checklist (do this first, in order)

1. Create a GitHub account (if you do not have one).
2. Create a Claude account at claude.ai.
3. Create a Neon account and a new project (this gives you a database connection string).
4. Create a Vercel account and connect it to your GitHub.
5. Create an OpenRouter account and add a small amount of credit; create an API key.
6. Create a file storage account (start with Vercel Blob since it is the simplest with Vercel).
7. Create an Inngest account (you will connect it later, in the document-processing phase).
8. Confirm the MiniMax M3 model is available on OpenRouter and note its exact model name.

> **Security reminder**
> Never paste API keys or database passwords into a chat, a public repo, or the browser front-end. They live only in environment variables (a secure settings area in Codespaces and Vercel). This plan shows you exactly where they go.

---

## 4. Part 2: The AI-assisted development method

You will not write most of the code by hand. You will direct AI tools to write it, then test it in Codespaces, and feed any errors back to the AI to fix. This section explains the method clearly so you stay in control.

### 4.1 Which AI for which job

| Tool | Best used for | How you use it |
|------|---------------|----------------|
| Claude (claude.ai) | Planning, writing full files of code, explaining errors, debugging, writing SQL, writing the AI prompts that run inside your app. | Describe the task, paste relevant code or errors, copy its output into Codespaces. |
| v0.dev | Generating good-looking React + Tailwind screens fast (forms, tables, dashboards). | Describe the screen or paste a sketch; copy the component into your project, then refine with Claude. |
| GitHub Copilot (optional, in Codespaces) | Small in-editor suggestions and autocompletions while you type. | Optional add-on inside the browser editor. |

> **Claude Code is optional, not required**
> Claude Code is a powerful command-line AI tool, but it normally needs installation. Because you are on a locked-down laptop, the browser workflow (Claude chat + Codespaces) is the recommended path. If your Codespace allows it, Claude Code can also be run inside the Codespace terminal later — but you do not need it to finish this project.

### 4.2 The golden loop (repeat this for every feature)

1. Pick the smallest next piece (for example, "the New Project form", not "the whole app").
2. Ask Claude to build that one piece. Give it context: the tech stack, the file path, and what the piece must do.
3. Copy the generated code into the correct file in Codespaces.
4. Run the app in Codespaces and look at the result in the preview tab.
5. If it works, commit it to GitHub (a save point). If not, copy the exact error message back to Claude and ask it to fix it.
6. Repeat for the next piece.

> **Why small pieces win**
> AI writes correct code far more reliably when the task is small and specific. Building in small, tested steps also means that when something breaks, you know exactly which step caused it.

### 4.3 How to prompt Claude well

A good coding prompt has five parts. Use this shape every time:

- **Role & stack:** "You are helping me build a Next.js 14 app with the App Router, TypeScript, Tailwind, and Neon Postgres."
- **The exact task:** "Create the New Project form with these fields…"
- **Constraints:** "Keep AI logic out of UI files. Never generate quantities. Use server actions."
- **The file path:** "Put this in src/app/projects/new/page.tsx."
- **Output format:** "Give me the complete file, ready to paste, with short comments."

> **Three habits that prevent most problems**
> 1. Always ask for the complete file, not a snippet — it is easier to paste and avoids merge mistakes.
> 2. When you hit an error, paste the FULL error text. Do not summarise it.
> 3. After a feature works, ask Claude: "What could break here, and what is the simplest test?"

---

## 5. Part 3: The complete feature set

This is everything the app does, grouped by area. Features marked NEW were added on top of your original brief to make the product stronger and more usable.

### 5.1 Core features (from your brief)

- Create a project and choose the measurement standard: POMI, NRM2, NRM1 (cost plan), or Custom.
- Upload project documents and a BOQ template (drawings, specs, schedules, previous BOQs).
- Automatic document classification (type and scope), with manual correction.
- Text and table extraction, chunking, and RAG indexing using pgvector.
- AI generation of BOQ item descriptions and units — never quantities, rates, or amounts.
- Unit selection checked against the BOQ rule database, not guessed by the model.
- Assumption register and query (RFI) register, created automatically.
- A QA checker that flags duplicates, wrong units, missing data, and conflicts.
- An editable BOQ review table with review statuses (draft, needs review, approved, rejected, revised).
- A BOQ rule library to manage units, description rules, inclusions, and exclusions.
- Excel export using the uploaded template, with source, assumption, and query register sheets.
- A clear, visible notice that the BOQ is AI-generated and requires QS review.

### 5.2 Added features (improvements)

| Feature | What it adds | Why it matters |
|---------|--------------|----------------|
| Authentication (NEW) | User sign-up and login with Clerk from Phase 1. | Nothing is safe to deploy without it; also enables the team feature. |
| Team members & roles (NEW) | Owner, editor, and reviewer roles per project. | QS firms have several people on one project. |
| Item revision history (NEW) | Stores the before/after of every edit, with who and when. | Audit trail is essential in commercial QS work. |
| QS correction learning (NEW) | Saves edits so they can become future examples for the AI. | The product gets better with use. |
| Confidence threshold (NEW) | Items below a set confidence are auto-marked needs review. | Saves time on large BOQs; focuses attention. |
| AI cost meter (NEW) | Shows the token cost of each generation run. | Prevents surprise API bills. |
| Inline editing + autosave (NEW) | Edit descriptions and units directly in the table; saves automatically. | Much faster than opening each item. |
| Bulk actions (NEW) | Approve, reject, or re-assign a trade for many items at once. | A QS reviews hundreds of items. |
| Search & filter (NEW) | Filter the BOQ by trade, status, confidence, or keyword. | Navigation in large BOQs. |
| Clickable source links (NEW) | Each item links back to the source document and page. | Builds trust; speeds verification. |
| Version comparison (NEW) | Compare the current BOQ draft against a previous version. | Track what changed between runs. |
| Email notifications (NEW) | Tells the QS when a long job is ready for review. | Jobs can take minutes; no need to wait. |
| Activity log (NEW) | A timeline of actions taken on a project. | Accountability and troubleshooting. |
| Dark mode (NEW) | Comfortable viewing for long review sessions. | Reduces eye strain; expected in modern apps. |

### 5.3 Out of scope (do not build in version 1)

- Automatic quantity take-off (measuring areas, lengths, counts from drawings).
- Rates, pricing, and amounts of any kind.
- MEP, structural, landscape, and other trades — these come in later phases.
- DWG, IFC, or Revit file parsing — future work.

> **Item type tagging (a small, high-value NEW idea)**
> Even though the app does not measure quantities, it can tag each item with the kind of measurement the QS will need: enumerated (No), linear (m), area (m²), or volume (m³). This is just a label that guides the QS — it does not produce a number. It is cheap to add and very helpful.

---

## 6. Part 4: Technical architecture

The system has four layers. Keeping them separate is what makes the app maintainable and lets you swap the AI model later without rewriting everything.

### 6.1 The four layers

- **1) Interface layer —** the website the user sees (Next.js, React, Tailwind), hosted on Vercel.
- **2) AI agent layer —** the agent roles (classifier, description writer, unit checker, QA, etc.), all powered by one model via OpenRouter, and run inside background jobs.
- **3) Data & storage layer —** Neon Postgres (with pgvector for search) for structured data, and blob storage for the big uploaded files.
- **4) Output layer —** the Excel export built from the uploaded template, with quantities, rates, and amounts left blank.

### 6.2 Technology stack summary

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS | Hosted on Vercel. |
| Auth | Clerk | Simple, hosted login. Alternative: NextAuth.js. |
| Database | Neon Postgres | Keep large files OUT of the database. |
| Vector search | Neon + pgvector | Stores embeddings for RAG. |
| File storage | Vercel Blob (or S3 / R2) | Big PDFs and Excel files. |
| Background jobs | Inngest (or Trigger.dev) | Long processing and AI workflows. |
| AI gateway | OpenRouter → MiniMax M3 | One key, swappable model. |
| Excel export | ExcelJS (Node) | Preserves template formatting. |
| PDF/Excel reading | pdf-parse / pdfjs, SheetJS (xlsx) | Text and table extraction. |

### 6.3 Why processing runs in background jobs (not the web server)

Vercel web functions stop after a short time (a timeout). Reading a 60-page drawing, creating embeddings, and running several AI steps takes much longer than that. So those tasks run in a background job service (Inngest). The website starts the job, then shows a live status bar; the job does the slow work and updates the database when each step finishes.

### 6.4 The AI provider layer (swappable model)

All AI calls go through one small piece of code — the AI provider layer — not directly from the screens. This means the model name and provider live in one place. To change models later, you change one setting; you do not touch the rest of the app.

- AIProvider — the shared interface every provider follows.
- OpenRouterProvider — the default; calls MiniMax M3 through OpenRouter.
- Future providers — added later if a special task needs a different model.

> **Do not include DeepSeek**
> Per your brief, DeepSeek must not appear anywhere — not in the code, prompts, environment variables, or documentation. MiniMax M3 is the primary model.

### 6.5 Recommended folder structure

```text
src/
  app/                  (pages: dashboard, projects, upload, boq-review, settings)
  components/           (ui, boq, files, layout)
  lib/
    db/                 (database access)
    ai/
      providers/        (openrouter.ts, types.ts)
    storage/            (file upload/download)
    documents/          (extraction, chunking, classification, template-parser)
    boq/                (item building, QA checks)
    rules/              (rule lookups)
    export/             (ExcelJS export)
  workers/              (document-processing, boq-generation)
  prompts/              (one file per agent role)
  types/                (shared TypeScript types)
```

---

## 7. Part 5: Database schema

These are the tables the app needs. The first group is from your brief; the second group is the NEW tables that support the added features. Build the core tables first; add the vector and extra tables in their phases.

### 7.1 Core tables

| Table | Purpose |
|-------|---------|
| users | User accounts (managed with Clerk; a local row links to the Clerk user). |
| projects | Project details and the chosen measurement standard. |
| project_files | Uploaded file metadata and the storage URL (not the file itself). |
| document_chunks | Extracted text chunks plus embeddings (pgvector) for RAG. |
| boq_rules | Unit rules and description rules per standard, scope, and item type. |
| boq_templates | Uploaded BOQ template metadata and detected structure. |
| boq_items | Generated BOQ items (description, unit; quantity/rate/amount stay blank). |
| boq_assumptions | Assumptions raised by the agent. |
| boq_queries | Clarification queries / RFIs. |
| agent_jobs | Background job status and progress. |

### 7.2 New tables (for the added features)

| Table | Purpose |
|-------|---------|
| project_members | Links users to projects with a role (owner, editor, reviewer). |
| boq_item_revisions | A history row each time an item is edited (old value, new value, who, when). |
| boq_corrections | Stores QS corrections (original AI output vs. the corrected version) to improve future prompts. |
| notifications | Messages for users, e.g. "your BOQ is ready for review". |
| activity_log | A timeline of actions on a project (uploaded, generated, edited, exported). |
| ai_usage | Token counts and estimated cost per generation run (powers the cost meter). |

### 7.3 Key design rules for the schema

- boq_items keeps quantity, rate, and amount columns, but the app must always leave them blank.
- Every boq_item should store a source_reference and a confidence_score.
- Large files never go in the database — only their storage URL and metadata.
- Add the item_type tag column (No, m, m², m³) to guide the QS on measurement type.
- Add a measurement_standard column on projects and use it in every generation prompt.

> **Let AI write the exact SQL**
> You do not need to memorise SQL. In the database phase, give Claude this table list and ask it to produce the full CREATE TABLE statements with sensible types, foreign keys, and an index on the embedding column. Then paste the SQL into the Neon SQL editor.

---

## 8. Part 6: UI and UX design plan

This product is used by busy professionals to do serious, billable work. The design must feel calm, trustworthy, and fast. The guiding idea: the screen should help a Quantity Surveyor work quickly and feel in control, while always making clear that the AI output is a draft for review.

### 8.1 Design principles

- **Clarity over decoration.** Plain layouts, generous space, no clutter. The data is the hero.
- **Trust by transparency.** Always show where an item came from, how confident the AI is, and that it needs review.
- **Speed for experts.** Inline editing, bulk actions, keyboard shortcuts, and fast filters.
- **Forgiveness.** Autosave, undo, revision history, and clear confirmations before anything irreversible.
- **Consistency.** One set of components, colours, and patterns used everywhere.

### 8.2 Visual design system

#### 8.2.1 Colour

Use a calm, professional palette. One primary colour for actions, neutral greys for surfaces and text, and four status colours that carry consistent meaning across the whole app.

| Role | Use | Suggested colour |
|------|-----|------------------|
| Primary | Main buttons, active links, highlights | Deep blue (e.g. #1F4E79 / #2E75B6) |
| Neutral | Backgrounds, borders, body text | White, light grey, dark slate grey |
| Success | Approved items | Green |
| Warning | Needs review / low confidence | Amber |
| Danger | Rejected items / conflicts / delete | Red |
| Info | Source links, hints, AI badges | Soft blue |

> **Accessibility rule for colour**
> Never use colour as the only signal. Pair every status colour with text or an icon (for example, an amber dot AND the word "Needs review"). Keep text contrast at WCAG AA or better so it is readable for everyone, including in bright office lighting.

#### 8.2.2 Typography

- Use one clean, professional typeface (for example, Inter or the system font stack).
- Three text sizes for hierarchy: page title, section heading, and body. Keep body around 14–16px.
- Use weight (regular vs. medium) and spacing for hierarchy — avoid many sizes.
- Numbers and units should be easy to scan; align units in a consistent column.

#### 8.2.3 Spacing and layout grid

- Use an 8-pixel spacing system (8, 16, 24, 32…) so everything lines up.
- Main layout: a left sidebar for navigation and a wide main content area.
- Keep comfortable padding around tables and cards so the screen never feels cramped.
- Design for large screens first (QS work on desktops/laptops), but keep it usable on a tablet.

#### 8.2.4 Core components

- Buttons: a clear primary style and a quieter secondary style; a separate red style for destructive actions.
- Inputs and selects: 36–40px tall, with visible focus rings for keyboard users.
- Cards: white surface, thin border, rounded corners, used for projects and summaries.
- Badges/pills: small coloured labels for status, scope, and confidence.
- Data table: the most important component — sortable, filterable, with inline editing.
- Modals: only for focused tasks (confirm delete, edit rule); never hide important info behind them.
- Toasts: small temporary messages for "saved", "exported", or errors.
- Progress bar / stepper: shows the live job status during generation.

### 8.3 Navigation structure

A fixed left sidebar gives one-click access to the main areas. The top bar shows the current project name, the user menu, dark-mode toggle, and the AI cost meter.

- Dashboard
- Projects
- Upload documents
- Document review
- BOQ rule library
- Generate BOQ
- BOQ review
- Query register
- Assumption register
- Export
- Settings

### 8.4 Screen-by-screen design

#### 8.4.1 Dashboard

- Shows all projects as cards or a table: name, client, standard, status, last updated.
- A clear "New project" button, top right.
- Each project shows a small status badge and a progress hint (e.g. "Ready for review").
- Empty state for first-time users: a friendly panel with a "Create your first project" button and a one-line explanation.

#### 8.4.2 New project (a short wizard)

- Step 1: Project name and client name.
- Step 2: Project type and scope (default to Architecture + Internal Design for the MVP).
- Step 3: Measurement standard — POMI, NRM2, NRM1 (cost plan), or Custom — with a one-line description of each so the user picks correctly.
- A progress indicator across the top; a clear "Create project" at the end.

#### 8.4.3 Upload documents

- A large drag-and-drop area plus a "browse" button.
- Each file shows a row with its name, size, type, and an upload progress bar.
- Large files upload directly to storage (using a secure link), so the page never freezes.
- Clear messages for unsupported files or files that are too large.
- After upload, a button to start classification.

#### 8.4.4 Document review

- A table of uploaded files with the AI-detected document type and scope.
- The user can correct the type or scope with a dropdown in each row.
- A confidence indicator on each classification.
- A "Confirm and continue" button once the user is happy.

#### 8.4.5 BOQ rule library

- A searchable table of rules: standard, scope, item type, unit, and the rule text.
- Add, edit, and delete rules; clear inclusion and exclusion fields.
- Filter by standard and scope so the right rules are easy to find.
- This is admin-style, so it can be denser — but still clear and well spaced.

#### 8.4.6 Generate BOQ

- A summary of the project, documents, and chosen standard before starting.
- A single "Generate BOQ draft" button.
- After starting: a live status panel showing the steps (classifying, extracting, indexing, matching rules, generating, checking) with progress.
- An estimated cost shown before and after the run (the AI cost meter).
- When done, a clear "Review BOQ" button; an email notification is also sent.

#### 8.4.7 BOQ review (the most important screen)

This is where the QS spends most of their time, so it must be excellent. Design it as a powerful, calm data grid.

- Columns: item no., section/trade, item type tag (No/m/m²/m³), description, unit, source, confidence, status. Quantity, rate, and amount columns are shown but visibly blank and locked.
- Inline editing: click a description or unit to edit it directly; changes autosave.
- Status control on each row: draft, needs review, approved, rejected, revised — colour-coded.
- Confidence colour-coding: low-confidence rows are gently highlighted so they stand out.
- Clickable source links: clicking the source opens the document at the right page.
- Bulk actions: select many rows to approve, reject, or re-assign their trade at once.
- Filter and search bar: by trade, status, confidence, or keyword.
- Duplicate highlighting: items the QA checker thinks are duplicates are flagged together.
- A persistent banner: "AI-generated draft — review required before pricing or tender."
- Keyboard shortcuts: move row to row, approve, and edit without the mouse.

#### 8.4.8 Query register and assumption register

- Query register: a table of open questions (RFIs) with the issue, the clarification needed, the source, and a status (open, answered, closed).
- Assumption register: a table of assumptions with the item, the assumption, and the source.
- Each query/assumption links back to the related BOQ item.

#### 8.4.9 Export

- A preview of what will be exported (sheets and columns), so there are no surprises.
- Confirmation that quantities, rates, and amounts will be blank.
- A clear download button producing the .xlsx file from the uploaded template.
- Extra sheets added automatically: source register, assumption register, query register, and the AI-review notice.

### 8.5 Interface states (design all four)

Every screen and component must be designed for four states, not just the "happy" one:

- **Empty:** no data yet — show a friendly prompt and the next action.
- **Loading:** show skeleton placeholders or a progress bar, never a frozen screen.
- **Error:** explain what went wrong in plain words and how to retry.
- **Success:** confirm the result clearly (a toast or a status change).

### 8.6 The trust layer (design for an AI product)

Because the output is AI-generated and used for serious work, trust is a design feature, not an afterthought. Build these signals into the UI:

- A small "AI-generated" badge on generated content.
- A confidence indicator on every item, with low values clearly marked.
- A visible source reference on every item, one click from the original document.
- A permanent review notice on the BOQ and in the exported file.
- Clear separation between what the AI produced and what the QS has approved.

### 8.7 Accessibility and quality bar

- Meet WCAG AA contrast for text and controls.
- Everything works with the keyboard alone; focus is always visible.
- All inputs have labels; all icons used as buttons have text alternatives.
- Respect reduced-motion settings; keep animations short and purposeful.
- Test on a normal laptop screen and a tablet.

> **How to produce these screens fast**
> Use v0.dev to generate each screen from the descriptions above (paste the bullet list as the prompt). Then bring the component into Codespaces and ask Claude to connect it to your data and apply the design system. This gives you good-looking screens quickly without designing pixel by pixel.

---

## 9. Part 7: The phase-by-phase build plan

Build in this order. Each phase ends with something that works and is saved to GitHub. Do not move to the next phase until the current one runs. Each phase lists the steps and gives a starter prompt you can paste into Claude.

### 9.1 Phase 0 — Setup (the foundation)

Goal: get a blank Next.js app running in the browser, connected to GitHub and Vercel, with environment variables ready.

1. Create all the accounts from the checklist in Part 1.
2. On GitHub, create a new empty repository (for example, boq-agent).
3. Open the repository in a Codespace (the green "Code" button → "Create codespace").
4. In the Codespace terminal, create a Next.js app with TypeScript, Tailwind, and the App Router.
5. Run the app and open the preview to confirm it works.
6. Add environment variables in the Codespace (database URL, OpenRouter key, storage token, Clerk keys).
7. Connect the repository to Vercel and do a first deploy to confirm the live site works.
8. Commit your work to GitHub (your first save point).

**Starter prompt:** use the prompt in Appendix A.1 to scaffold the project and explain each command.

### 9.2 Phase 1 — Auth, database, projects, and upload

Goal: users can log in, create a project, and upload files. (Authentication is moved here, into Phase 1, so the app is safe from the start.)

1. Add Clerk and protect the app so only logged-in users can enter.
2. In Neon, create the core tables (use Claude to write the SQL, then run it in the Neon SQL editor).
3. Connect the app to Neon using a database client.
4. Build the Dashboard page (list projects).
5. Build the New Project wizard (name, client, type, scope, measurement standard).
6. Build the Upload page with direct-to-storage upload (secure links) and progress bars.
7. Save file metadata (name, type, storage URL) to the project_files table.
8. Commit to GitHub and deploy to Vercel.

**Starter prompts:** Appendix A.2 (auth), A.3 (schema), A.4 (new project form), A.5 (file upload).

### 9.3 Phase 2 — BOQ rule library

Goal: a working, editable rule database. Build this before the AI, because the AI depends on it to choose correct units.

1. Create the boq_rules table.
2. Build the rule library page: list, add, edit, delete rules.
3. Add filters by measurement standard and scope.
4. Seed the database with a starter set of Architecture + Internal Design rules for POMI and NRM2 (doors, windows, partitions, finishes, skirting, painting, waterproofing, joinery, ironmongery).
5. Have a Quantity Surveyor review and approve the seeded rules.
6. Commit and deploy.

> **Treat rule seeding as a content task, not just code**
> The quality of the whole app depends on these rules being correct. Ask a QS to check them. You can ask Claude to draft an initial rule set from POMI/NRM2 logic, but a human QS must verify the units and wording before you rely on them.

**Starter prompt:** Appendix A.6 (rule library + starter rules).

### 9.4 Phase 3 — Document processing

Goal: turn uploaded files into searchable text. This is where background jobs and the template parser come in.

1. Connect Inngest for background jobs.
2. Extract text and tables from PDFs and Excel files (start with text-based PDFs and Excel schedules — the most reliable sources).
3. Build the BOQ template parser: detect the sheet, columns (description, unit, quantity, rate, amount), and item numbering style from the uploaded template.
4. Split extracted content into chunks and attach metadata (file, page, scope, document type).
5. Create embeddings and store chunks in document_chunks using pgvector.
6. Build basic document classification (type and scope) and the Document Review page with manual correction.
7. Show job status using the agent_jobs table.
8. Commit and deploy.

**Starter prompts:** Appendix A.7 (background jobs + extraction), A.8 (template parser), A.9 (chunking + embeddings).

### 9.5 Phase 4 — AI BOQ generation

Goal: produce BOQ descriptions and units. This is the heart of the product.

1. Build the AI provider layer (OpenRouter → MiniMax M3) with the model in one settings file.
2. Write the system prompts for each agent role and store them in the prompts folder.
3. Add few-shot examples to each prompt (real input → perfect output).
4. Build the generation job: retrieve relevant chunks (RAG), identify work items, check units against the rule database, and write descriptions and units.
5. Force the model to return structured JSON and save items to boq_items (quantity, rate, amount left blank).
6. Record token cost in ai_usage for the cost meter.
7. Generate assumptions and queries and save them.
8. Build the Generate BOQ page with the live status panel.
9. Commit and deploy.

> **The non-negotiable prompt rules**
> Every generation prompt must say: generate descriptions and units only; never quantities, rates, or amounts; use the selected standard; confirm units against the rule database; raise a query instead of guessing; always give a source reference; mark uncertain items as needs review.

**Starter prompts:** Appendix A.10 (AI provider), A.11 (generation prompt + JSON shape).

### 9.6 Phase 5 — Review and QA

Goal: the QS can review, edit, and approve items, and see assumptions and queries.

1. Build the BOQ Review data grid with inline editing and autosave.
2. Add review statuses, confidence colour-coding, and clickable source links.
3. Add bulk actions (approve, reject, re-assign trade) and search/filter.
4. Save every edit to boq_item_revisions, and save corrections to boq_corrections.
5. Build the Query Register and Assumption Register pages.
6. Build the QA checker: flag duplicates, wrong units, missing data, and conflicts (as comments/queries, not silent fixes).
7. Add duplicate highlighting and the persistent review banner.
8. Commit and deploy.

**Starter prompts:** Appendix A.12 (review grid), A.13 (QA checker).

### 9.7 Phase 6 — Excel export

Goal: download an editable Excel BOQ draft based on the uploaded template.

1. Use ExcelJS to fill the uploaded template with descriptions and units.
2. Keep quantity, rate, and amount blank.
3. Add the source register, assumption register, and query register sheets.
4. Add the AI-review notice to the workbook.
5. Build the Export page with a preview and a download button.
6. Commit and deploy.

**Starter prompt:** Appendix A.14 (Excel export).

### 9.8 Phase 7 — Improve drawings and add polish

1. Improve drawing and image understanding (use the model's capabilities for clearer drawings; keep scanned/poor images as low-confidence and raise queries).
2. Improve source referencing (link to the exact page/drawing).
3. Add the activity log, email notifications, dark mode, and version comparison.
4. Add an onboarding tour for first-time users.
5. Add keyboard shortcuts on the review grid.
6. Commit and deploy.

### 9.9 Phase 8 — Add sub-agents (later)

Once the Architecture + Internal Design workflow is solid and trusted, expand one trade at a time:

- Furniture / FF&E
- Plumbing
- Mechanical
- Electrical
- Fire fighting
- Landscape
- Structural
- Full multi-trade BOQ package

> **Designed to grow**
> Because each agent is the same model with a different prompt and rule set, adding a new trade means adding a new prompt and new rules — not rebuilding the app. The Main Coordinator combines the items; the QA agent checks the final draft before export.

---

## 10. Part 8: Testing and quality

You do not need a heavy testing setup for the MVP, but you do need confidence that the important things work. Focus testing where mistakes would hurt a real QS.

- **Unit accuracy:** run real schedules through the app and check that units match the rule database every time.
- **The blank rule:** confirm quantity, rate, and amount are always blank, on screen and in the export.
- **Conflicts become queries:** feed a spec and drawing that disagree and check the app raises a query instead of guessing.
- **Template fidelity:** export with several different uploaded templates and confirm the structure is respected.
- **Edge files:** try a scanned PDF and confirm it is marked low-confidence with a query, not a confident wrong answer.
- **Permissions:** confirm a reviewer cannot do owner-only actions.

> **A simple QA habit**
> Keep a small folder of real sample documents and a checklist of expected results. Re-run it after each big change. Ask Claude to help write a short automated test for the most critical logic (the unit checker).

---

## 11. Part 9: Deployment and launch

1. Vercel deploys automatically every time you push to GitHub — no manual steps once connected.
2. Set the production environment variables in Vercel (the same keys you used in Codespaces).
3. Use a Neon production branch separate from your test data.
4. Turn on the background job service for production.
5. Do a full run-through on the live site with a real project before sharing it.
6. Share the link with one trusted QS first; collect feedback; then widen access.

> **Keep secrets safe in production**
> Production keys live only in Vercel's environment settings. Never commit a file containing real keys to GitHub.

---

## 12. Part 10: Risk management and cost control

### 12.1 Main risks and how this plan handles them

| Risk | How the plan reduces it |
|------|-------------------------|
| Wrong units in the BOQ | The rule database is the source of truth; the QA checker double-checks; low confidence is flagged. |
| AI guesses when documents conflict | Prompts force a query instead of a guess; the query register makes it visible. |
| Drawings are hard to read | Start with schedules and text PDFs; mark scanned drawings low-confidence and raise queries. |
| Long processing times | Background jobs handle slow work; the UI shows live status; email tells the QS when done. |
| Surprise AI bills | The cost meter and ai_usage table track spend; OpenRouter lets you set limits. |
| MiniMax availability/region | OpenRouter gateway means you can switch models with one setting if needed. |
| Free-tier limits run out | Stop Codespaces daily; monitor Neon and Vercel usage; upgrade only when needed. |
| Losing work | Commit to GitHub often; each commit is a save point you can return to. |

### 12.2 Keeping costs low while you build

- Stay on free tiers during development; they are enough for one builder and test data.
- Test AI prompts on small documents first; only run full projects when the prompt is good.
- Cache embeddings so you do not re-create them for the same file.
- Stop your Codespace when you finish each day.
- Add a small amount of OpenRouter credit at a time and watch usage.

---

## 13. Appendix A: Ready-to-use prompts for Claude

Copy these into Claude, then adjust the details. Replace anything in CAPS with your own values. Always ask for the complete file, ready to paste.

### A.1 Project setup

```text
You are helping me build a web app from a browser using GitHub Codespaces.
I cannot install software on my laptop. The stack is: Next.js 14 (App
Router), TypeScript, Tailwind CSS, Neon Postgres, hosted on Vercel.

Give me the exact terminal commands to create a new Next.js app in my
Codespace with TypeScript, Tailwind, ESLint and the App Router. Explain
each command in one line. Then tell me how to run it and open the preview.
```

### A.2 Authentication (Clerk)

```text
Add authentication to my Next.js 14 App Router app using Clerk.
I want only logged-in users to access the app. Give me the complete steps:
which package to install, which environment variables to set, the exact
files to create or edit (with full file contents), and how to protect all
routes except the sign-in page. Keep it beginner-friendly.
```

### A.3 Database schema

```text
Write PostgreSQL CREATE TABLE statements for a Neon database for these
tables: users, projects, project_files, boq_rules, boq_templates,
boq_items, boq_assumptions, boq_queries, agent_jobs, project_members,
boq_item_revisions, boq_corrections, notifications, activity_log, ai_usage.

boq_items must include description and unit, plus quantity, rate, amount
columns that will stay blank, plus source_reference, confidence_score,
item_type tag, and review_status. projects must include measurement_standard.
Use UUID primary keys, sensible foreign keys, and timestamps. I will add the
pgvector document_chunks table later, so leave a clear note where it goes.
```

### A.4 New project form

```text
Create the New Project page at src/app/projects/new/page.tsx for my Next.js
14 app. It is a 3-step wizard: (1) project name + client name, (2) project
type + scope (default Architecture + Internal Design), (3) measurement
standard (POMI, NRM2, NRM1 cost plan, Custom) with a one-line description of
each. On submit, save to the projects table using a server action. Use
Tailwind, show a progress indicator, and keep AI logic out of this file.
Give me the complete file.
```

### A.5 File upload (direct to storage)

```text
Build a file upload page for my Next.js 14 app that uploads large PDFs and
Excel files directly to Vercel Blob using secure upload URLs (not through a
normal API route, because of size limits). Show each file with a progress
bar. After upload, save the file name, type, size, and storage URL to the
project_files table. Give me the complete files and explain the setup.
```

### A.6 BOQ rule library + starter rules

```text
Build a BOQ rule library page (list, add, edit, delete) backed by the
boq_rules table, with filters for measurement standard and scope. Then give
me a starter set of rules for Architecture + Internal Design under POMI and
NRM2 for: doors, windows, partitions, wall finishes, floor finishes, ceiling
finishes, skirting, painting, waterproofing, joinery, ironmongery. For each:
the correct unit and a short description rule. Add a note that a qualified QS
must verify these before use.
```

### A.7 Background jobs + extraction

```text
Set up Inngest in my Next.js 14 app for background jobs. Create a job that
reads an uploaded file from storage and extracts text and tables: use a PDF
text extractor for text-based PDFs and SheetJS (xlsx) for Excel. Save the
extracted content and update the agent_jobs table with progress. Give me the
complete files and the setup steps.
```

### A.8 BOQ template parser

```text
Write a function that reads an uploaded Excel BOQ template with SheetJS and
detects its structure: which sheet holds the BOQ, and which columns are
description, unit, quantity, rate, and amount (by reading the header row),
plus the item numbering style. Return a structured object. Handle templates
where columns are in a different order. Give me the complete function with
comments and a short explanation.
```

### A.9 Chunking + embeddings

```text
Write code to split extracted document text into meaningful chunks with
metadata (file id, page, scope, document type, section), create embeddings
for each chunk, and store them in a Neon table called document_chunks using
pgvector. Also give me the SQL to create document_chunks with a vector column
and an index. Explain how to query the nearest chunks for a search later.
```

### A.10 AI provider layer (OpenRouter to MiniMax M3)

```text
Create an AI provider layer for my app so the model is configurable and not
hard-coded in the UI. Make an AIProvider interface and an OpenRouterProvider
that calls MiniMax M3 through OpenRouter, reading the API key and model name
from environment variables. Include a function that requests STRICT JSON
output and safely parses it. Do not include DeepSeek anywhere. Put this in
src/lib/ai/providers/. Give me the complete files.
```

### A.11 Generation prompt + JSON shape

```text
Write the system prompt and the request for my BOQ description generator.
Rules the model MUST follow: generate BOQ item descriptions and units only;
never quantities, rates, or amounts; use the selected measurement standard
(POMI, NRM2, or NRM1); confirm units against the provided rule list; if
information is missing or conflicting, create a query instead of guessing;
always give a source reference; mark uncertain items as needs_review.
Return strict JSON with boq_items (section, scope, item_type, description,
unit, source_reference, confidence_score, review_status), assumptions, and
queries. Include 3 few-shot examples for doors and finishes.
```

### A.12 BOQ review grid

```text
Build the BOQ Review page as a data grid for my Next.js app. Columns: item
no, section/trade, item type tag (No/m/m2/m3), description, unit, source,
confidence, status. Show quantity, rate, amount columns but locked and blank.
Inline-edit description and unit with autosave (server action). Status is a
colour-coded dropdown (draft, needs_review, approved, rejected, revised).
Highlight low-confidence rows. Add bulk approve/reject/re-assign and a filter
bar (trade, status, confidence, keyword). Save each edit to boq_item_revisions.
Show a permanent banner: AI-generated draft, review required.
```

### A.13 QA checker

```text
Write a QA checker that reviews generated BOQ items before export. It must
flag: wrong units (against the rule list), duplicate items, missing source
references, conflicting spec vs drawing info, and missing material/size/fire
rating/finish code. It must create comments and queries rather than silently
changing items. Return a structured list of issues linked to item ids.
```

### A.14 Excel export

```text
Using ExcelJS, write code that takes the uploaded BOQ template and fills in
the description and unit columns from my boq_items, leaving quantity, rate,
and amount blank. Preserve the template formatting. Add three extra sheets:
source register, assumption register, and query register. Add a notice that
the BOQ is AI-generated and must be reviewed by a QS. Output a downloadable
.xlsx. Give me the complete code.
```

---

## 14. Appendix B: Pre-launch checklist

- Login works; only logged-in users can enter.
- A project can be created with a measurement standard.
- Files upload directly to storage; metadata is saved.
- Documents are classified; the user can correct them.
- The rule library has QS-approved Architecture + ID rules.
- Generation produces descriptions and units; quantity/rate/amount are blank.
- Units match the rule database; conflicts raise queries.
- The review grid allows inline edit, status changes, and bulk actions.
- Source links open the right document/page.
- The query and assumption registers work.
- Export produces the template-based .xlsx with the extra sheets and the review notice.
- The cost meter shows spend; OpenRouter has a limit set.
- The AI-review notice is visible in the app and the export.
- Production environment variables are set in Vercel; no keys are in GitHub.
- A full run-through on the live site passed with a real project.

---

## 15. Appendix C: Glossary

| Term | Plain meaning |
|------|---------------|
| BOQ | Bill of Quantities — a structured list of work items for a construction project. |
| POMI / NRM2 / NRM1 | Measurement standards that define how items are described and which units are used. |
| RAG | Retrieval-Augmented Generation — the AI is given the relevant document pieces before it answers. |
| Embedding | A numeric form of text that lets the computer find similar pieces of text. |
| pgvector | A Postgres add-on that stores embeddings and searches them. |
| Few-shot examples | Example input-and-output pairs placed inside a prompt to show the AI the pattern to copy. |
| Background job | Slow work that runs separately from the website so the page never freezes. |
| Environment variable | A secure setting (like an API key) kept out of the code and out of the browser. |
| Codespace | A full code editor and computer that runs in your browser — no install needed. |
| Server action | A safe way for a Next.js page to run code on the server (e.g. save to the database). |
| RFI | Request For Information — a formal query to clarify missing or conflicting information. |
| Confidence score | How sure the AI is about an item; low scores are flagged for review. |

---

*End of plan — build in small steps, test each one, and keep the QS in the loop.*
