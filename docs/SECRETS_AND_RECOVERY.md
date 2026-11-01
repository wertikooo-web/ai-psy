# Secrets and recovery checklist

## Never commit
`.env`, `.env.local`, provider tokens, database service-role keys, production dumps, real consultation audio, transcripts and private records.

## Configure independently
- `NEXT_PUBLIC_SUPABASE_URL`: recipient Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: recipient anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only secret
- `OPENAI_API_KEY`: recipient API key
- `NEXT_PUBLIC_DEMO_MODE`: defaults to false
- `PROF_DEV_USER_ID`: optional legacy server-side user identifier used by `lib/supabase/auth.ts`. **This is not authentication.** Restrict usage to a private, access-controlled dev environment.
- Optional Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_INTERNAL_SECRET`, `TELEGRAM_LINK_CODE_PEPPER`, `TELEGRAM_BOT_USERNAME`, `APP_BASE_URL`.

## External material you cannot recreate merely by cloning
- Supabase live tables, blobs and storage bucket settings
- Railway environment variables, deployments, volumes, DNS and billing
- OpenAI project account, billing limits and API keys
- Files ignored by `.gitignore` and other local uncommitted assets

## Recovery validation
- Inspect local `git status --short` and `git status --ignored` before an archival export.
- Make a private encrypted backup of Supabase PostgreSQL and Storage using vendor-supported backup/export workflows.
- Save a redacted inventory of Railway variable **names** and connected services, not the secret values.
- Confirm restorability in an isolated test environment with synthetic records.
- Perform a full-history secret scan and rotate any credential found exposed.
- Keep the legal agreement and IP/license terms separate from the source code until finalized.
