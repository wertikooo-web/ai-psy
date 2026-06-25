# TRANSCRIPT AI PSY — Project State (as of 2026-06-25)

## What is done

### Core Infrastructure
- [x] Next.js 15 App Router project with TypeScript + Tailwind
- [x] Railway deployment with persistent `/data` volume
- [x] File-based JSON storage layer (`lib/storage.ts`)
- [x] AppShell with responsive sidebar (desktop always-on, mobile overlay)

### Pages & Features
- [x] **Home dashboard** — AnimatedCityScene + stats (recent clients, recent consultations)
- [x] **Clients** — list, add, detail page with history
- [x] **Consultations** — list, detail with transcript viewer and AI analysis
- [x] **AI Chat** — streaming chat with Claude, psychologist context
- [x] **Knowledge Base** — viewer for markdown files from `/data/knowledge_base/`
- [x] **Notebook** — psychologist's private notes (CRUD)
- [x] **Voice Notes** — record/upload voice memos with metadata
- [x] **Observation Modal** — floating FAB for quick notes (Win+H voice dictation hint)
- [x] **Settings** — profile editing (name, photo, email, specialty)
- [x] **Upload Modal** — audio file upload flow

### AnimatedCityScene (home page background)
- [x] Animated city with day/evening/night time modes (CityTint overlay)
- [x] Ground actors: cat, dog, human (man/woman/child), car, bike, bus, bird
- [x] Per-level depth (near/mid/far) with scale
- [x] Contralateral human gait (natural arm/leg sync)
- [x] Human stop behavior (28% chance) + reverse/turn-around (18% chance)
- [x] Cat/dog stop behavior (cat looks around, dog pees)
- [x] Click cat/dog → speed up (up to 8×)
- [x] Crow easter egg: flies in → perches → turns frontal → tucks legs → caws → flies away
- [x] Window escaper easter egg
- [x] Paper airplane easter egg
- [x] Interactive perched bird (clickable, sits on rooftop, y=34-38% from viewport bottom)
- [x] Interactive cat from building edge (y=15-17% from viewport bottom = ground floor)
- [x] Actor overlay via React portal (escapes overflow:hidden Chromium clipping bug)
- [x] Sidebar z-index (z=10) covers actors (z=1) so actors appear from behind sidebar
- [x] No actor pairs (spawn interval 18-34s, no double-spawn logic)
- [x] Actor finish timeout +2500ms buffer (prevents early disappearance)
- [x] Window lighting **removed** (was broken, caused yellow rectangles in content area)

### API
- [x] All CRUD routes for clients, consultations, notebook, voice notes
- [x] Audio file serving
- [x] Claude AI analysis of transcripts
- [x] Streaming AI chat
- [x] Profile management

---

## What is NOT done / remaining

### Whisper Integration (next priority)
- [ ] `OPENAI_API_KEY` must be set in Railway Variables
- [ ] `/api/transcribe` route exists but needs to be tested end-to-end
- [ ] `/api/voice-notes/transcribe` route exists but may need Whisper config
- [ ] Upload flow: audio file → Whisper API → transcript stored → analyze with Claude
- [ ] Test with real audio files

### Docling (after Whisper)
- [ ] Docling for PDF/document parsing (future integration)
- [ ] Use case: upload session notes in PDF → extract text → add to consultation

### Polish / Known Issues
- [ ] Interactive cat position may need fine-tuning (y=15-17% from viewport bottom)
- [ ] Interactive bird position may need fine-tuning (y=34-38% from viewport bottom)
- [ ] Actors appear from left viewport edge on mobile (no sidebar on mobile — acceptable)
- [ ] Human reverse animation timing not fully verified

---

## Architecture files to read at session start
- `ARCHITECTURE.md` — full system architecture
- `PROJECT_STATE.md` — this file
- `components/home/AnimatedCityScene.tsx` — if working on city animation
- `components/AppShell.tsx` — if working on layout/z-index

## Last commits
- `2aa5ac3` — Remove window lighting feature entirely
- `bf240de` — Fix city scene bugs: windows, bird/cat positions, actor pairs
- `35bd3ea` — Crow front-facing pose with leg tuck
