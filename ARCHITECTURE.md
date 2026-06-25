# TRANSCRIPT AI PSY — Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, `"use client"` where needed) |
| Language | TypeScript |
| Styling | Tailwind CSS + inline styles |
| Storage | Railway Volumes (`/data` persistent disk) |
| Deployment | Railway |
| AI | Anthropic Claude API (claude-sonnet-4-6 / claude-opus-4-8) |
| Transcription | OpenAI Whisper (planned: `whisper-1` via API) |
| Document parsing | Docling (planned) |

---

## Directory Structure

```
transcript-ai-psy/
├── app/
│   ├── layout.tsx              — root layout: AppShell wrapper
│   ├── page.tsx                — home/dashboard (AnimatedCityScene + stats)
│   ├── clients/                — client list
│   ├── client/[id]/            — single client detail
│   ├── consultations/          — consultation list
│   ├── consultation/[id]/      — single consultation view (transcript + analysis)
│   ├── ai-chat/                — AI assistant chat
│   ├── knowledge-base/         — psychological knowledge base viewer
│   ├── notebook/               — psychologist's private notes
│   ├── voice-notes/            — voice memos
│   ├── psy-gpts/               — GPT personas
│   ├── settings/               — profile / API keys / preferences
│   └── api/
│       ├── clients/            — CRUD: /data/clients.json
│       ├── consultations/      — CRUD: /data/consultations/*.json
│       ├── transcribe/         — upload audio → Whisper → save transcript
│       ├── analyze/            — transcript → Claude analysis
│       ├── chat/               — AI chat stream
│       ├── knowledge-base/     — serve /data/knowledge_base/*.md files
│       ├── notebook/           — CRUD: /data/notebook/*.json
│       ├── voice-notes/        — CRUD + audio: /data/voice_notes/
│       ├── upload/             — file upload handler
│       ├── profile/            — /data/profile.json
│       ├── calendar/           — consultation calendar
│       └── client-history/     — per-client timeline of analyses
│
├── components/
│   ├── AppShell.tsx            — flex layout: sidebar + main; z-index layering
│   ├── Sidebar.tsx             — nav sidebar (desktop always-on, mobile overlay)
│   ├── home/
│   │   └── AnimatedCityScene.tsx  — entire animated city: actors, crow, windows, easter eggs
│   ├── dashboard/              — StatsCard, ClientList, ConsultationList, LastConsultationCard
│   ├── client/                 — AddClientModal, ClientCard
│   ├── consultation/           — ConsultationCard, transcript viewer
│   ├── observation/            — ObservationModal (voice dictation FAB)
│   ├── upload/                 — UploadModal (audio file → transcription)
│   ├── ui/                     — Button, Badge, Avatar primitives
│   └── UserChip.tsx            — profile chip in sidebar footer
│
├── lib/
│   ├── storage.ts              — file-based JSON storage helpers (Railway /data volume)
│   └── claude.ts               — Anthropic SDK client
│
├── public/
│   └── city.png                — city background image (aspect ratio 1400:520 for AnimatedCityScene)
│
└── knowledge_base/             — local markdown files for the knowledge base feature
```

---

## Z-Index Stacking (AnimatedCityScene)

```
Root stacking context
├── z=0  — city scene div (position:absolute inside section)
│          └── city.png image, CityWindows SVG, CityTint div
├── z=1  — actor overlay portal (position:fixed at document.body)
│          └── ActorEl, CrowScene, InteractiveBird, InteractiveCat,
│              WindowEscaper, PaperPlane
└── z=10 — sidebar wrapper (position:relative, AppShell)
└── z=10 — main content (position:relative, AppShell)
```

Actors at z=1 are covered by sidebar (z=10) → appear to come from behind sidebar edge.

**Why portal?** Chromium on Windows clips `position:fixed` children of `overflow:hidden` scroll containers (known Blink bug). Portal to `document.body` escapes all AppShell ancestors.

**CityWindows SVG height:** Must use `height:"auto"` (NOT `"100%"`). The containing city-scene div has no explicit height; `height:100%` resolves to 100vh (section height) in Chromium, placing windows far above buildings. `height:"auto"` uses the SVG intrinsic aspect ratio (viewBox 1400×520) to match city image dimensions exactly.

---

## Data Storage

All data lives in `/data/` on the Railway Volume (persistent across deploys):

```
/data/
├── clients.json
├── profile.json
├── consultations/{id}.json       — consultation + transcript + analysis
├── notebook/{id}.json
├── voice_notes/{id}.json + audio
└── knowledge_base/               — markdown files
```

---

## AnimatedCityScene Key Concepts

- **ActorType**: `cat | dog | human | car | bike | bird | bus`
- **GroundLevel**: `0` (near) | `1` (mid) | `2` (far) — max 1 actor per level at a time
- **TimeMode**: `day | evening | night` — weights, opacity, window glow
- **Actor bottom position**: `BOTTOM_BASE[type] + LEVEL_CFG[level].extraBottom` px from viewport bottom
- **Bird perch spots**: y=34-38% from viewport bottom (rooftop level)
- **Interactive cat spots**: y=15-17% from viewport bottom (building ground floor)
- **Animation**: CSS keyframes injected to `<head>`. Unique name per speed level forces browser restart → negative delay trick works.
- **Spawn interval**: 18-34s between ground actors (no pairs)
- **Crow sequence**: flying-in → perched → looking (frontal) → sitting (legs tuck) → cawing → flying-out

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/clients` | GET/POST | List / create clients |
| `/api/clients/[id]` | GET/PUT/DELETE | Single client |
| `/api/consultations` | GET/POST | List / create consultations |
| `/api/consultations/[id]` | GET/PUT/DELETE | Single consultation |
| `/api/consultations/[id]/audio` | GET | Serve audio file |
| `/api/transcribe` | POST | Upload audio → Whisper → store transcript |
| `/api/analyze` | POST | Transcript → Claude → psychological analysis |
| `/api/chat` | POST | Streaming AI chat |
| `/api/knowledge-base` | GET/[filename] | Serve markdown knowledge files |
| `/api/notebook` | GET/POST/PUT/DELETE | Notes CRUD |
| `/api/voice-notes` | GET/POST | Voice memos |
| `/api/voice-notes/[id]/audio` | GET | Serve audio |
| `/api/voice-notes/transcribe` | POST | Whisper transcription |
| `/api/profile` | GET/PUT | Psychologist profile |
| `/api/upload` | POST | Generic file upload |
