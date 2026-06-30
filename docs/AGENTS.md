# TRANSCRIPT AI · PSY - AGENTS.md

## Purpose

This file is the single operating guide for all AI agents working on TRANSCRIPT AI · PSY.

It replaces separate duplicated agent instructions such as `CLAUDE.md` and `AI_RULES.md`.

All agents should treat this file as the main source of rules for coding, review, architecture, safety, Git workflow, Supabase work, UI changes, testing, and reporting.

## Project

Project: TRANSCRIPT AI · PSY

Type: AI-assisted workspace for practicing psychologists.

Stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI APIs

Current default AI provider: OpenAI.

The architecture may support Anthropic and DeepSeek, but they can remain mock or secondary implementations unless the user explicitly asks otherwise.

## Product Mission

TRANSCRIPT AI · PSY helps psychologists work with client material.

The product helps psychologists:

- manage clients;
- store consultations;
- create transcripts;
- maintain client history;
- run AI-assisted analysis;
- continue case exploration through consultation chat.

The main goal is not CRM functionality.

The main goal is a safe, useful workspace for real psychological practice.

## Core Workflow

The core MVP flow is:

```text
Client -> Consultation -> Transcript -> AI Analysis -> Chat -> Client History
```

Every implementation decision should support this workflow.

Priority order:

1. Client
2. Consultation
3. Transcript
4. AI Analysis
5. Consultation Chat
6. Client History

Do not add large new product areas while this workflow is unstable.

## Mandatory Session Start

Before working with code, every agent must:

1. Read `project_state.md`.
2. Read `NEXT_STEPS.md`.
3. Check the current branch.
4. Check Git status.
5. Pull the latest changes.

Use:

```bash
git branch
git status
git pull
```

Do not repeat a full codebase audit if `project_state.md` already gives the current state.

If `project_state.md` is outdated, inspect the real codebase before updating it.

## Current Known Implementation Facts

These facts override older documentation:

- Supabase is connected and works in production.
- Do not follow old instructions saying "Do not connect Supabase yet".
- The main consultation page component is `RealConsultationView.tsx`, not `ConsultationClient.tsx`.
- Analyses are stored in `consultations.analyses` as a JSONB array, not in a separate analyses table.
- Request history is already implemented through migrations and `clientRequests.ts` DAL.

## Branch Strategy

Never work directly in `main`.

Branches:

- `main` - stable branch.
- `ai-dev` - main working branch for AI agents.
- feature branches may be created from `ai-dev` when useful.

Before work:

```bash
git checkout ai-dev
git pull
git status
```

The working tree should be clean before making changes.

## Git Workflow

After changes:

```bash
git status
git diff
```

If the changes are correct:

```bash
git add .
git commit -m "ai: short description"
git push
```

Commit messages should be short and practical.

Examples:

```text
ai: add basic auth middleware
ai: prepare missing schema migrations
ai: refactor whisper service
ai: split consultation view layout
```

Never commit:

- `.env`
- `.env.local`
- API keys
- `node_modules`
- `.next`
- private uploaded files
- real client data

## Destructive Commands

Do not run destructive commands without explicit user approval.

Forbidden without approval:

```bash
git reset --hard
git clean -fd
rm -rf
npm install
pnpm install
supabase db push
supabase migration up
```

Before cleaning files, use preview:

```bash
git clean -fdn
```

## Sensitive Data Rules

This project may contain psychological consultation data, transcripts, audio references, client notes, and private clinical material.

Never expose, print, export, or send client data outside the local project unless the user explicitly asks.

Never add real client data to:

- tests;
- examples;
- fixtures;
- screenshots;
- documentation.

Use anonymized sample data only.

## Human Approval Gates

Ask the user before:

- changing database schema;
- applying migrations;
- deleting fallback systems;
- changing authentication strategy;
- installing dependencies;
- moving many files;
- splitting large components;
- changing deployment settings;
- touching secrets or environment variables;
- modifying knowledge base content.

## Scope Control

Work on one small task at a time.

Do not rewrite large parts of the project unless explicitly asked.

For a new task, first identify:

- files to change;
- files to avoid;
- possible risks;
- how to test the result.

Then make the smallest useful change.

## Default First Response for Risky Tasks

For risky work, begin with:

```text
I will first inspect the relevant files and propose a minimal plan. I will not change files until the plan is clear.
```

Then inspect, plan, and wait for approval if needed.

## Protected Areas

Do not modify these without explicit approval:

```text
.env
.env.local
.env.production
supabase/schema.sql
supabase/migrations/
package.json
package-lock.json
pnpm-lock.yaml
next.config.*
knowledge_base/
```

For Supabase migrations, create SQL files only. Do not apply them automatically.

## Security Rules

This app handles sensitive psychological material.

Do not expose it publicly while pages or API routes are unprotected.

For current single-user deployment, prefer middleware-level Basic Auth or another simple whole-app protection.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

Never move service-role logic into client components.

## Supabase Rules

Supabase is the current production storage layer.

Do not assume schema changes are already applied.

If code expects a column, check whether the column exists in schema and migrations.

When creating a migration, include:

- forward SQL;
- rollback SQL;
- explanation;
- risk notes;
- manual Supabase run instructions.

Do not apply migrations automatically.

## Data Storage Direction

Local JSON storage may exist as fallback or legacy code, but Supabase is the production source.

The project should eventually decide between:

- removing the JSON fallback;
- completing it fully for all features.

Do not remove the JSON fallback without explicit approval.

## Architecture Direction

Move toward small replaceable modules.

Prefer:

```text
one module
one responsibility
clear input
clear output
small surface area
```

Avoid:

```text
large monolithic components
duplicated service logic
hidden side effects
mixed UI, data, and AI logic in one file
```

Current refactoring priorities:

1. Protect pages and API routes for single-user deployment.
2. Prepare missing database migration SQL files.
3. Consolidate duplicated audio and Whisper logic.
4. Decide the future of JSON fallback.
5. Split large UI components only after security and data issues are stable.

## Client Model

Each client contains:

### Overview

Short summary of the case.

### Consultations

List of consultation sessions.

### Client History

Structured long-term context.

Sections:

- key themes;
- working hypotheses;
- resources;
- significant life events;
- what has already been explored;
- what requires further exploration;
- therapist notes.

Use the name `Client History`.

Do not use `Client Memory`.

### Materials

Imported files and reference material:

- therapist notes;
- previous GPT analyses;
- historical transcripts;
- intake forms;
- additional documentation.

## Consultation Creation

Supported sources:

### Audio Recording

Formats:

- mp3
- m4a
- wav

Flow:

```text
Audio -> Whisper -> Transcript -> Analysis
```

### Existing Transcript

Formats:

- txt
- md
- pasted text

Flow:

```text
Transcript -> Analysis
```

### Therapist Notes

Manual text entry.

Flow:

```text
Notes -> Analysis
```

Notes must be clearly identified as notes, not as a full transcript.

## Consultation Page

The consultation page is the most important screen.

It contains:

- consultation header;
- transcript panel;
- AI analysis panel;
- consultation chat panel.

The consultation header shows:

- client name;
- session number;
- date;
- duration;
- status;
- actions.

The client name must not be used as the header of the AI Analysis panel.

## UI Rules

Do not make broad visual redesigns inside functional tasks.

When changing UI:

- keep the current visual language;
- avoid unrelated components;
- check desktop layout first;
- preserve existing Russian interface text unless asked to rewrite it.

Large files such as `RealConsultationView.tsx` and `TranscriptPanel.tsx` should be split gradually, not rewritten in one pass.

## Scroll Behavior

Scroll behavior is critical.

Expected behavior:

- sidebar remains fixed;
- consultation header remains visible;
- transcript panel scrolls independently;
- analysis panel scrolls independently;
- chat panel scrolls independently;
- chat input remains fixed at the bottom.

Do not rely on page-level scrolling.

Check:

- `h-screen`
- `min-h-0`
- `overflow-hidden`
- `overflow-y-auto`

A missing `min-h-0` commonly breaks panel scrolling.

## Collapsible Panels

Transcript, Analysis, and Chat panels should support collapse and expand.

When collapsed:

- panel becomes a narrow tab;
- content is hidden;
- remaining panels expand automatically.

Do not use checkboxes for this behavior.

Use dedicated panel controls.

## Analysis Modes

Supported modes:

| Mode | Meaning |
|---|---|
| `working` | Working Analysis |
| `deep` | Deep Analysis |
| `therapist_process` | Therapist Process Analysis (+A) |
| `gestalt` | Gestalt Analysis (+G) |

Use `therapist_process`.

Do not use `therapist`.

## Knowledge Base Rules

Location:

```text
knowledge_base/
```

Main file:

```text
000_CORE_INSTRUCTIONS.md
```

This file must always be loaded first.

Prompt composition order:

1. Core Instructions
2. Knowledge Map
3. Mode-specific files
4. Client Context
5. Transcript or Notes
6. Current Task

Do not modify knowledge base content without approval.

## Client Context Assembly

Client context should be assembled from:

- client profile;
- Client History;
- Materials;
- previous consultations;
- previous analyses.

The context should be concise and relevant.

## AI and LLM Rules

Keep prompts and analysis logic modular.

Do not hardcode prompt behavior inside UI components.

Do not mix transcript parsing, evidence extraction, UI rendering, and OpenAI calls in one place.

Prefer dedicated service files for:

- transcription;
- analysis;
- evidence extraction;
- prompt loading;
- client materials;
- session summary.

## Whisper Rules

Use OpenAI Whisper API for transcription.

Flow:

```text
Audio File -> Whisper -> Transcript -> Consultation
```

If a transcript already exists, require confirmation before regenerating.

## Materials Inside Consultation

A consultation may contain:

- audio recording;
- transcript;
- AI analysis.

These should be presented as consultation assets.

Example:

```text
Audio Recording
Transcript
AI Analysis
```

## Testing and Verification

After any code change, run the lightest available checks.

Prefer:

```bash
npm run lint
npx tsc --noEmit
```

If scripts are unavailable, report that clearly.

For UI changes, describe exactly what the user should click and check.

Before deployment, run:

```bash
npm run build
```

Deployment target: Railway.

Repository: GitHub.

## Updating Project State

When the user says "обнови project state", "обнови состояние проекта", "актуализируй PROJECT_STATE", or similar:

1. Do not trust `PROJECT_STATE.md` blindly.
2. Inspect the real codebase, migrations, API routes, components, package.json, and git diff.
3. Update `PROJECT_STATE.md` to reflect the real implementation.
4. Update `NEXT_STEPS.md`:
   - remove completed tasks;
   - mark partial tasks accurately;
   - add only next steps that follow from the current MVP workflow.
5. Do not invent features.
6. Do not mark something as working unless it exists in code or was verified.
7. Include update date.
8. Keep the core workflow as priority.

## Agent Roles

### Claude Code

Role: Implementation Engineer.

Responsibilities:

- new features;
- bug fixes;
- small refactoring.

Never:

- rewrite architecture without approval;
- delete modules without approval;
- make broad redesigns during functional work.

### Codex

Role: Senior Reviewer.

Responsibilities:

- find bugs;
- simplify code;
- review changes;
- check edge cases;
- suggest safer implementation paths.

Never:

- make large UI redesigns without approval;
- turn review into a rewrite unless asked.

### Antigravity

Role: Chief Architect.

Responsibilities:

- architecture audit;
- coupling analysis;
- refactoring strategy;
- AI-agent readiness checks;
- documentation structure review.

Never:

- rewrite working code only for style;
- make structural changes without a plan and approval.

## Collaboration Between Agents

Do not let multiple agents edit the same task at the same time.

Finish, commit, and push one agent's work before giving the next agent a review task.

Suggested flow:

```text
Claude Code -> implementation
Codex -> code review
Antigravity -> architecture review
User -> approve merge to main
```

## Agent Report Format

After finishing a task, always report:

```text
Changed files:
- ...

What changed:
- ...

How to test:
- ...

Risks:
- ...

Next suggested step:
- ...
```

## Documentation Rules

Avoid duplicated sources of truth.

One topic should live in one place.

Keep documentation short, accurate, and current.

If a document contains outdated instructions, update or remove them instead of adding a contradictory note elsewhere.

`AGENTS.md` is the main rule file for all agents.

## Project Principle

The goal is not beautiful code for its own sake.

The goal is a working, safe, maintainable tool for real psychological practice.

Prioritize:

```text
safety
data privacy
small changes
clear modules
easy rollback
```
