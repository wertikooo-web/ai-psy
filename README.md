# TRANSCRIPT AI · PSY

AI-assisted workspace for psychologists: clients, consultation transcripts, AI analysis, consultation chat and case history.

**Status: developer handoff / MVP. Not security-certified or production-ready for real patient records.**

## Technology
Next.js 15 / React 19 / TypeScript / Tailwind; Supabase PostgreSQL and private Storage; OpenAI Whisper and chat models; FFmpeg; Railway deployment configuration.

## First-time local setup
Requirements: Node.js 20+, npm, git; FFmpeg for audio compression; an independent Supabase project and OpenAI API account.

```bash
git clone https://github.com/wertikooo-web/ai-psy.git
cd ai-psy
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell replace the copy command with `Copy-Item .env.example .env.local`. App defaults to http://localhost:3000. Supply your **own** API keys in `.env.local` and never commit them.

## Database and files
See [docs/CLIENT_HANDOFF.md](docs/CLIENT_HANDOFF.md). Create a **new independent** Supabase project. `supabase/schema.sql` is the initial schema and `supabase/migrations/002_*.sql` onward contains subsequent changes. Review migration dependencies and test a clean setup before using real data. The current Supabase project is separate from this repository and should **never** be shared with a recipient.

Without Supabase settings the application can fall back to JSON files under `data/` and local audio files in `public/uploads/`. That fallback is unsuitable for Railway production because files can disappear on deployment.

## Environment
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. Other optional Telegram settings are documented in `.env.example`. Server-only secrets must stay server-only.

## Deployment
The repository includes `railway.json` and `nixpacks.toml`; Railway can build the Next.js app and install FFmpeg. Set environment values in the recipient's Railway project, not GitHub. Verify database, storage buckets, permissions and API access before enabling a public URL.

## Security warning
The original MVP assumes a single trusted operator and may expose API endpoints without robust user authentication. Treat it as an **untrusted development baseline**. Do not upload real consultations or personal health data until authentication, per-user authorization, RLS, storage policies, backups and privacy requirements have been reviewed and verified. See [docs/CLIENT_HANDOFF.md](docs/CLIENT_HANDOFF.md).

## Developer documentation
- [Client handoff and acceptance checklist](docs/CLIENT_HANDOFF.md)
- [Project history / state](PROJECT_STATE.md) (historical, verify against current code)
- [Agent guidance](AGENTS.md)
- [Architecture](docs/ARCHITECTURE.md)

## License
No software license has been granted in this repository. Forking or commercial reuse requires the copyright holder's permission or a separately agreed license. See [docs/CLIENT_HANDOFF.md](docs/CLIENT_HANDOFF.md).
