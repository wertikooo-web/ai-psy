# TRANSCRIPT AI · PSY — Client / developer handoff

Prepared 2026-11-01. This document records verified repository structure and the outstanding tasks for a receiving developer. It is **not** a certificate that the app is safe for live psychological consultations.

## Ownership and delivery
Source: https://github.com/wertikooo-web/ai-psy
Suggested transfer: grant the recipient a private copy or permission to fork under separately agreed terms. No LICENSE file exists; **do not assume a public GitHub repository authorizes commercial reuse**. Agree in writing on IP ownership, modification rights, ongoing support and liability before commercial delivery.

Do not transfer current Supabase or Railway projects, production API credentials, stored consultations or audio. Recipient provisions their own accounts.

## Architecture map
Browser -> Next.js application on Railway -> Next.js API routes -> `lib/data/` -> Supabase PostgreSQL and Storage.
AI requests: Next.js server routes -> OpenAI API. No standalone SQL server to install: PostgreSQL is managed by Supabase. Next.js listens on the port configured by the hosting platform; local development uses port 3000.

Key code:
- `app/api/clients/route.ts`, `app/api/consultations/route.ts` — API endpoints.
- `lib/data/clients.ts`, `lib/data/consultations.ts` — database access.
- `lib/supabase/server.ts` — server-side Supabase credentials.
- `lib/audio/uploadAudio.ts` — FFmpeg compression and Supabase Storage `audio` bucket.
- `knowledge_base/` — prompts and professional knowledge base.
- `supabase/schema.sql` + `supabase/migrations/` — schema and subsequent migrations.
- `railway.json`, `nixpacks.toml` — deployment instructions.

## Clean installation sequence
1. Clone or fork the repository into a recipient-controlled GitHub account.
2. Install Node.js 20+ and dependencies with `npm ci`.
3. Create a **fresh** Supabase project. Preserve its project URL and publishable/anon key; obtain the service-role/secret key in secure storage.
4. Read and apply `supabase/schema.sql`, then inspect and apply remaining migrations in dependency order using a disposable database first. Validate every table and RPC. Do not assume a blind bulk run is idempotent.
5. Configure storage buckets (including `audio`) as **private**, with authorization and signed URL tests. Verify the additional buckets required by the current code.
6. Copy `.env.example` to `.env.local` and populate project-specific values. Never paste credentials in tickets, chat, GitHub or client-facing documents.
7. Start `npm run dev`; verify the full workflow with synthetic sample clients.
8. Before any public deployment, implement/test login, authorization on **every API endpoint**, user ownership of each record, and Supabase RLS. Do not rely only on a hidden UI or an obscured URL.
9. Deploy recipient fork to an isolated Railway project, add variables and review build logs. Avoid unencrypted logs with personal content.
10. Run independent security and data-protection review before processing live client information.

## Required environment variables
- `OPENAI_API_KEY`: server-side OpenAI credentials (usage billed to recipient).
- `NEXT_PUBLIC_SUPABASE_URL`: recipient Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: recipient browser-safe publishable/anon key (if used).
- `SUPABASE_SERVICE_ROLE_KEY`: powerful **server-only** credential; never use `NEXT_PUBLIC_` prefix.
- Optional Telegram variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_INTERNAL_SECRET`, `TELEGRAM_LINK_CODE_PEPPER`, `TELEGRAM_BOT_USERNAME`, `APP_BASE_URL`.

## Critical blockers before real clients
- Single-user MVP was originally built **without authentication**. The inspected `GET/POST /api/clients` handler calls the data layer without a login or record ownership check. Other endpoints must be audited, too. Production release is blocked.
- Server Supabase client uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS; authorization must therefore be enforced on server routes as well.
- Local fallback writes `data/*.json` and `public/uploads/`; Railway ephemeral disk makes this inappropriate for persistent records.
- Supabase project linked to the original development was observed as **INACTIVE** on 2026-11-01. It is not part of the recipient setup; no data was copied or migrated.
- No complete credential-history audit, software dependency scan, penetration test, data retention/deletion audit or production smoke test has been completed in this handoff.
- Current repository has no explicit LICENSE file. Written agreement is required for commercial rights.

## Acceptance tests with fake data only
- New user signs in; anonymous user receives 401/403 on every protected endpoint.
- User A cannot query/update/delete User B's records via API URLs or direct Supabase access.
- Create client -> consultation -> audio upload -> Whisper transcription -> analysis -> consultation chat -> case history.
- Audio bucket is private; random unauthenticated URL fetch fails; only short-lived authorized links work.
- Deletion and retention policies cover text, audio, logs, backups and generated AI materials.
- Restart/redeploy Railway and verify persistent records remain intact.
- Inspect Railway and OpenAI billing under recipient-owned accounts.
- `npm ci`, `npx tsc --noEmit`, `npm run build` and a manual browser smoke test all succeed.

## Separate accounts and costs
GitHub stores code; Railway runs the service; Supabase stores the database and uploaded files; OpenAI handles inference and transcription. These services are separately billed. Exact current costs depend on the recipient account and usage.

## Support boundary
This repository represents an existing implementation and handoff documentation. It does not promise a turnkey installation, automatic schema migrations, secure multi-user tenancy, clinical suitability or regulatory compliance. Acceptance requires the tests above and independent review.
