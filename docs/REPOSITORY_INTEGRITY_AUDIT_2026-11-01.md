# TRANSCRIPT AI · PSY: repository handoff integrity audit
Date: 2026-11-01
Scope: GitHub repository `wertikooo-web/ai-psy`, branches `main` and `ai-dev`.

## Confirmed inventory
- At start of this audit both branches resolved to identical Git trees, with **493 committed files**.
- Next.js 15, React 19, TypeScript, OpenAI SDK, Supabase SDK; `package.json` and `package-lock.json`.
- App pages, API routes, UI components, knowledge base, agent rules and Claude/Codex configuration.
- Database bootstrapping: `supabase/schema.sql` plus **25 incremental SQL files (002 through 026)**.
- Deploy configuration: `railway.json`, `nixpacks.toml`, `.env.example`.
- Placeholder demos: `lib/mockData.ts` exports empty client and consultation arrays; `lib/mockHistoryData.ts` contains example history but is not a complete client database.
- Original production-like Supabase project `transcript-ai-psy` was previously reported as INACTIVE. We could not query its tables, live records or storage.
- Original Railway service runtime configuration and billing are **not accessible through the GitHub repository**.

## Cannot establish from GitHub
- Uncommitted local Windows files, drafts, recordings, external database backups or previous IDE buffers.
- Live Railway environment variables, secrets, mounted volumes, environment overrides or deployment status.
- Values of OpenAI/Telegram/Supabase credentials. **Never transfer real credentials via GitHub.** Recipients create their own.
- Whether every historical Git commit is free of leaked credentials. A full secret-history scan is still needed.
- Exact database and audio contents, especially any real client information.
- Clean deployment and end-to-end tests (no test run or deployment performed during this audit).

## Security findings
- `app/api/clients/route.ts` GET and POST have no per-request authentication guard, so using a shared service-role key may expose highly sensitive data.
- `lib/supabase/auth.ts` contains a single-tenant `PROF_DEV_USER_ID` fallback; it must not be treated as user login or session verification.
- Fallback local JSON/files are nonpersistent on a standard ephemeral Railway filesystem.
- Some synthetic example history exists, but `lib/mockData.ts` has **empty clients and consultations**.
- No LICENSE is present; permission for commercial reuse should be agreed in writing.

## Delivery boundary
Repository = source, committed assets, schemas, templates, version history. It is not a copy of the existing runtime/database and must not contain actual API keys or patient files.

## Recovery workflow for recipient
1. Fork/clone repository and record commit SHA.
2. Provision isolated Railway, Supabase and OpenAI accounts.
3. Create fresh database from `supabase/schema.sql`, then inspect/apply migrations 002–026 in order and check table + storage dependencies.
4. Fill `.env.local` locally or Railway Variables. Add `PROF_DEV_USER_ID` only for legacy single-tenant testing, never as a public security boundary.
5. Load **synthetic-only fixtures** from `fixtures/demo-clients.json` for reference; this file is not an automatic seed command.
6. Before using real patient information: implement authenticated APIs, tenant isolation, RLS policies, private storage, backup/restore and audit logs.
7. Test complete client → consultation → transcript → AI analysis → chat workflow in a clean environment.
8. Export original database and storage only via **encrypted private transfer** and only when authorized; never commit them to public GitHub.

## Final verdict
**Committed code and development branches can be transferred; complete recovery of external data, keys and uncommitted working files is not verifiable from repository access.** The app is not certified production-safe.
