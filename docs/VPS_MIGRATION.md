# TRANSCRIPT AI · PSY: VPS migration status

Prepared 2026-11-01. Full source remains in GitHub main and ai-dev.

## Facts verified
- A connected Supabase PostgreSQL project exists and is ACTIVE_HEALTHY.
- 27 application tables exist, including 6 clients, 7 consultations, 34 consultation chat messages, 29 client materials, 10 client history records.
- The uploaded Supabase Storage archive must be transported separately; do not publish it to the public repository.
- Current application uses the Supabase JS client for PostgREST and Storage, including server-side service-role access. Merely installing PostgreSQL on a VPS does **not** remove the Supabase dependency.

## How to deploy without Supabase
Migration requires actual backend changes before the app can operate with plain PostgreSQL and disk storage:
1. Install PostgreSQL 17 and create a private database/user on VPS.
2. Replace the `lib/supabase/*` access paths and `lib/data/*` Supabase calls with a PostgreSQL driver/ORM. Maintain identical table semantics, record IDs and relation keys.
3. Replace `supabaseServer.storage.from(...)` with a safe private filesystem or S3-compatible abstraction; map `storage://bucket/path` references.
4. Restore a **database backup** exported from the source project using `pg_dump` / approved vendor export procedures, plus the supplied Storage ZIP.
5. Set OpenAI secrets exclusively as VPS environment variables; keep them outside source control.
6. Implement access control for consultation data, signed/download access to files and encrypted backups.
7. Test upload -> transcription -> analysis -> chat and confirm data survives server redeploy.

## Portable backup command (run from a trusted machine with PostgreSQL 17 client)
```bash
# Use the private session-pooler or direct DATABASE_URL provided by Supabase Connect.
# Do not paste DATABASE_URL (contains a password) into GitHub or chat.
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file=ai-psy-data.dump
```
Use `pg_restore --list ai-psy-data.dump` to inspect. Restoring into a non-Supabase PostgreSQL installation may require excluding Supabase internal schemas and platform-specific extensions. Prefer a public-schema-only export where appropriate and test the restore.

## Archive safety
Source code and migration scripts may be shared publicly. Actual transcripts, names, audio, Telegram tokens, API keys and service credentials must remain outside this public repository even when believed to be synthetic. For development, import the supplied synthetic fixture or use a privately transferred database dump.

## Current deliverable boundary
The Git repository contains the app source and schema; this migration guide is preparatory. No claim is made that the app already runs without Supabase. Original database data and audio ZIP have **not** been committed to this public repository.
