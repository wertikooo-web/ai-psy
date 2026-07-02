# AI_RULES.md

## Project

Project: TRANSCRIPT AI · PSY  
Type: AI workspace for psychologists.  
Stack: Next.js, React, TypeScript, Tailwind, Supabase, OpenAI APIs.  
Main working branch for AI agents: `ai-dev`.  
Stable branch: `main`.

## Core Rule

Never work directly in `main`.

All AI agents must work only in `ai-dev` or in a dedicated feature branch created from `ai-dev`.

Before starting any task:

```bash
git branch
git status
git pull
```

The working tree must be clean before making changes.

## Safety Rules

Do not delete, rename, move, install packages, run migrations, or change environment variables without explicit approval.

Do not run destructive commands unless the user explicitly confirms them.

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

Use safe preview first when cleaning files:

```bash
git clean -fdn
```

## Sensitive Data

This project may contain psychological consultation data, transcripts, audio references, client notes, and private clinical material.

Never expose, print, export, or send client data outside the local project unless the user explicitly asks.

Never add real client data to tests, examples, fixtures, screenshots, or documentation.

Use anonymized sample data only.

## Git Workflow

Before work:

```bash
git checkout ai-dev
git pull
git status
```

After work:

```bash
git status
git diff
```

If changes are correct:

```bash
git add .
git commit -m "ai: short description"
git push
```

Commit messages should be short and practical:

```text
ai: add basic auth middleware
ai: prepare missing schema migrations
ai: refactor whisper service
ai: split consultation view layout
```

## Task Scope

Work on one small task at a time.

Do not rewrite large parts of the project unless the user explicitly requests it.

When asked to implement a feature, first identify:

- files to change;
- files to avoid;
- possible risks;
- how to test the result.

Then make the smallest useful change.

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
```

For Supabase migrations, create SQL files only. Do not apply them automatically.

## Architecture Direction

The project should move toward small replaceable modules.

Prefer this:

```text
one module
one responsibility
clear input
clear output
small surface area
```

Avoid this:

```text
large monolithic components
duplicated service logic
hidden side effects
mixed UI, data, and AI logic in one file
```

## Current Refactoring Priorities

Priority 1: Security and stability.

Recommended order:

1. Protect pages and API routes for single-user deployment.
2. Prepare missing database migration SQL files.
3. Consolidate duplicated audio and Whisper logic.
4. Decide whether to remove JSON fallback or fully support it.
5. Split large UI components only after security and data issues are stable.

## Security Direction

For current single-user deployment, prefer middleware-level Basic Auth or another simple whole-app protection.

Do not expose the app publicly while API routes are unprotected.

Be careful with `SUPABASE_SERVICE_ROLE_KEY`. It must stay server-side only.

## Supabase Rules

Do not assume schema changes are already applied.

If code expects a column, check whether the column exists in schema and migrations.

When creating a migration, include:

- forward SQL;
- rollback SQL;
- explanation;
- risk notes;
- how to run manually in Supabase.

## AI / LLM Rules

Keep prompts and analysis logic modular.

Do not hardcode prompt behavior in UI components.

Do not mix transcript parsing, evidence extraction, UI rendering, and OpenAI calls in one place.

Prefer dedicated service files for:

```text
transcription
analysis
evidence extraction
prompt loading
client materials
session summary
```

## UI Rules

Do not make broad visual redesigns inside functional tasks.

When changing UI:

- keep the current visual language;
- avoid touching unrelated components;
- check desktop layout first;
- preserve existing Russian interface text unless asked to rewrite it.

Large files such as `RealConsultationView.tsx` and `TranscriptPanel.tsx` should be split gradually, not rewritten in one pass.

## Testing and Verification

After any code change, run the lightest available checks.

Prefer:

```bash
npm run lint
npx tsc --noEmit
```

If these scripts are unavailable, report that clearly.

For UI changes, describe exactly what the user should click and check.

## Agent Output Format

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

## Collaboration Between Agents

Claude Code may implement features.

Codex may review, simplify, and find bugs.

Antigravity may audit architecture and check whether the project remains agent-friendly.

Do not let multiple agents edit the same task at the same time.

Finish, commit, and push one agent's work before giving the next agent a review task.

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
- touching secrets or environment variables.

## Default First Response to a New Task

When an AI agent receives a new task, it should begin with:

```text
I will first inspect the relevant files and propose a minimal plan. I will not change files until the plan is clear.
```

Then inspect, plan, and wait if the task is risky.

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
