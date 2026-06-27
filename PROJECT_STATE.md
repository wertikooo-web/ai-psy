# TRANSCRIPT AI · PSY — Project State
> Дата: 2026-06-27. Этот документ — точка восстановления. Читай его первым в новой сессии.

---

## 1. Назначение проекта

**Продукт:** AI-рабочее пространство для практикующих психологов.

**Для кого:** один психолог (single-user, без авторизации).

**Задача:** помочь психологу работать с материалом клиента — не просто хранить записи, а анализировать их и продолжать исследование в диалоге.

**Основной сценарий:**
```
Клиент → Консультация → Транскрипт → AI-анализ → Чат → История клиента
```

**Главные сущности:** Client, Consultation, Transcript, Analysis, ChatMessage, ClientHistory, ClientMaterial, VoiceNote, UserProfile.

---

## 2. Технологический стек

| Компонент | Технология | Версия |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.19 |
| UI | React | 19.0.0 |
| Язык | TypeScript | 5.x |
| Стили | Tailwind CSS | 3.4.17 |
| БД | Supabase (PostgreSQL) | @supabase/supabase-js 2.108.2 |
| Хранилище файлов | Supabase Storage | (3 buckets) |
| Хостинг | Railway | — |
| AI (анализ + чат) | OpenAI gpt-4o (configurable) | openai 6.44.0 |
| Транскрибация | OpenAI Whisper (whisper-1) | — |
| Сжатие аудио | FFmpeg | system (nixpacks) |
| Markdown | react-markdown | 10.1.0 |
| Иконки | lucide-react | 0.468.0 |
| Утилиты | clsx | 2.1.1 |
| Тестирование | — | не настроено |
| Lint | ESLint (next lint) | — |

**Scripts (package.json):**
```
dev:   next dev
build: next build
start: next start
lint:  next lint
```
> typecheck отдельной командой нет — используй `npx tsc --noEmit`.

---

## 3. Архитектура проекта

**Общая схема:**
```
Browser
  → Next.js App Router (RSC + "use client")
  → app/api/*/route.ts  (Server-only API routes)
  → lib/data/*.ts       (DAL: Supabase-first, JSON fallback)
  → Supabase DB / Supabase Storage / OpenAI
  → ответ в React state → обновление UI
```

**Frontend:** Next.js 15 App Router. Серверные компоненты загружают данные из Supabase напрямую через `lib/data/`. Клиентские компоненты (`"use client"`) управляют интерактивностью и общаются с API routes.

**Backend:** Только API routes в `app/api/`. Нет отдельного backend-сервера. Вся серверная логика — Next.js Route Handlers.

**Supabase:** Два клиента:
- `lib/supabase/server.ts` — service role key, обходит RLS, только в API routes и серверных компонентах.
- `lib/supabase/client.ts` — anon key, браузер (не используется в production коде, оставлен для будущего).

**AI-модели:** Вызываются только из API routes (`app/api/analyze/`, `app/api/chat/`, `app/api/transcribe/`). Никогда из клиентских компонентов.

**Три колонки консультации:**
```
RealConsultationView.tsx
├── TranscriptPanel.tsx  — показывает форматированный диалог или сырой текст
├── [анализ-колонка]     — inline в RealConsultationView (не отдельный компонент)
└── ChatPanel.tsx        — история чата, отправляет consultationId серверу
```

---

## 4. Карта директорий и ключевых файлов

```
transcript-ai-psy/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts          — AI-анализ (6 режимов) + фоновый запуск evidence
│   │   ├── evidence/[id]/route.ts    — GET: статус evidence; POST: (пере)генерация
│   │   ├── chat/route.ts             — чат консультации
│   │   ├── transcribe/route.ts       — транскрибация через Whisper
│   │   ├── upload/route.ts           — загрузка аудио + FFmpeg
│   │   ├── format-transcript/route.ts — разбивка по репликам (GPT-4o-mini)
│   │   ├── consultations/[id]/
│   │   │   ├── route.ts              — PATCH консультации (requestId, title, status)
│   │   │   ├── audio/route.ts        — DELETE аудио
│   │   │   ├── transcript-raw/route.ts — DELETE исходного транскрипта
│   │   │   └── chat/route.ts         — GET/POST/DELETE история чата
│   │   ├── client-requests/route.ts  — CRUD запросов клиента
│   │   ├── request-consultations/[requestId]/route.ts — список консультаций по запросу
│   │   ├── client-materials/[id]/route.ts
│   │   ├── client-history/[id]/route.ts
│   │   └── voice-notes/              — CRUD + transcribe голосовых заметок
│   ├── consultation/[id]/page.tsx    — страница консультации (SSR → RealConsultationView)
│   ├── client/[id]/page.tsx          — карточка клиента
│   ├── clients/page.tsx              — список клиентов
│   ├── settings/page.tsx             — настройки (модель AI, профиль)
│   ├── help/page.tsx                 — страница помощи
│   └── layout.tsx                   — корневой layout
│
├── components/
│   ├── consultation/
│   │   ├── RealConsultationView.tsx  — ГЛАВНЫЙ компонент страницы консультации
│   │   ├── TranscriptPanel.tsx       — левая колонка (транскрипт)
│   │   ├── ChatPanel.tsx             — правая колонка (чат)
│   │   └── ConsultationClient.tsx    — устаревший компонент (не используется в production)
│   ├── client/                       — компоненты карточки клиента
│   ├── upload/UploadModal.tsx        — модальное окно загрузки аудио/текста
│   └── ui/                           — общие UI компоненты
│
├── lib/
│   ├── data/                         — Data Access Layer (DAL)
│   │   ├── clients.ts                — CRUD клиентов → Supabase.clients
│   │   ├── consultations.ts          — CRUD консультаций → Supabase.consultations
│   │   ├── clientMaterials.ts        — CRUD материалов → Supabase.client_materials
│   │   ├── userProfile.ts            — чтение/запись профиля → Supabase.user_profile
│   │   ├── clientHistory.ts          — история клиента → Supabase.client_history
│   │   ├── voiceNotes.ts             — голосовые заметки → Supabase.voice_notes
│   │   ├── chatMessages.ts           — история чата → Supabase.consultation_chat_messages
│   │   └── clientRequests.ts         — запросы клиента → Supabase.client_requests
│   ├── supabase/
│   │   ├── server.ts                 — Supabase client с service role (серверный)
│   │   ├── client.ts                 — Supabase client с anon key (браузерный, резерв)
│   │   └── storage.ts                — обёртка для работы с bucket-ами
│   ├── consultationStore.ts          — JSON-fallback + TypeScript интерфейсы (AnalysisEvidence тип здесь)
│   ├── clientStore.ts                — JSON-fallback для клиентов
│   ├── analysisService.ts            — логика генерации анализа (chunking, LLM call)
│   ├── evidenceService.ts            — buildEvidence() — извлечение evidence из текста транскрипта
│   ├── knowledgeBase.ts              — сборка промптов из файлов knowledge_base/
│   ├── llm.ts                        — абстракция провайдера LLM
│   └── types.ts                      — общие TypeScript типы
│
├── knowledge_base/                   — Markdown-файлы для AI-промптов анализа
│   ├── 000_CORE_INSTRUCTIONS.md      — загружается всегда первым
│   ├── 00_КАРТА_БАЗЫ_ЗНАНИЙ.md      — загружается всегда вторым
│   └── 01–11_*.md                    — режим-специфичные файлы
│
├── supabase/migrations/
│   ├── 002_transcript_segments.sql   — добавляет колонки transcript_segments, transcript_formatted, *_deleted_at
│   ├── 003_user_profile_ai_settings.sql — analysis_style, analysis_length, chat_style, ai_instructions
│   ├── 004_analysis_evidence.sql     — добавляет колонку analysis_evidence jsonb в consultations
│   ├── 005_chat_messages.sql         — создаёт таблицу consultation_chat_messages
│   ├── 006_compressed_transcript.sql — compressed_transcript jsonb в consultations
│   ├── 007_client_materials_consultation_id.sql — consultation_id в client_materials
│   ├── 008_client_requests.sql       — создаёт таблицу client_requests, мигрирует clients.concern
│   ├── 009_rpc_client_requests.sql   — RPC: set_current_client_request, create_current_client_request
│   └── 010_consultations_request_id.sql — добавляет request_id uuid FK в consultations
│
├── data/                             — JSON-файлы (fallback, не используются в production)
├── public/uploads/                   — локальный fallback для аудио (не используется в production)
├── CLAUDE.md                         — инструкции для Claude Code
├── project_state.md                  — этот файл
├── NEXT_STEPS.md                     — рабочий список задач
└── nixpacks.toml                     — Railway build config (FFmpeg)
```

---

## 5. Модель данных

### Supabase таблицы (production)

#### `consultations`
Основная таблица. Хранит всё что связано с консультацией включая транскрипт и анализы в JSONB-полях.

| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| client_id | UUID | FK → clients.id |
| client_name, client_initials, client_color | text | денормализованные для быстрого показа |
| title | text | название консультации |
| source | text | "audio" / "transcript" / "notes" |
| status | text | "created" / "transcribing" / "ready" / "analyzing" / "done" / "error" |
| audio_file_name, audio_file_url, audio_file_size | text/int | путь в Supabase Storage |
| notes | text | заметки психолога (не транскрипт) |
| transcript_text | text | сырой текст Whisper |
| transcript_origin | text | "whisper" / "file" / "manual" |
| transcript_created_at | timestamptz | — |
| transcript_segments | jsonb | WhisperSegment[] — сегменты Whisper с start/end |
| transcript_formatted | jsonb | FormattedSegment[] — размеченный диалог по ролям |
| analyses | jsonb | Array<{id, mode, result, createdAt}> — все анализы |
| audio_deleted_at | timestamptz | soft-delete аудио |
| transcript_raw_deleted_at | timestamptz | soft-delete исходного транскрипта |
| transcript_formatted_deleted_at | timestamptz | soft-delete форматированного транскрипта |
| analysis_evidence | jsonb | AnalysisEvidence — скрытый слой доказательств |
| request_id | UUID | FK → client_requests.id (nullable), привязка к запросу клиента |
| deleted_at | timestamptz | soft-delete консультации |
| created_at | timestamptz | — |

**Важно:** `analyses` — это JSONB-массив, а не отдельная таблица. Каждый элемент:
```typescript
{ id: string; mode: string; result: string; createdAt: string; }
```
Режимы: `working`, `deep`, `hypothesis`, `therapist_process`, `gestalt`, `next_session`.

**`analysis_evidence`** — скрытый слой (UI не показывает). Структура:
```typescript
{
  sourceHash: string;              // sha256[0..16] транскрипта — stale если изменился
  createdAt: string;
  repeatedThemes: EvidenceItem[];
  repeatedPhrases: EvidenceItem[];
  uncertaintyMarkers: EvidenceItem[];
  possibleOffTopicAnswers: EvidenceItem[];
  importantQuotes: EvidenceItem[];
  possibleTranscriptionIssues: EvidenceItem[];
}
// EvidenceItem: { quote, speaker?, startSeconds?, confidence, reason }
```
Строится автоматически после первого анализа. Источник: transcript_formatted → transcript_text. Никогда не запускает Whisper/FFmpeg.

#### `clients`
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| full_name | text | имя клиента |
| initials, color | text | для аватара |
| age | int | возраст |
| concern | text | запрос клиента |
| status | text | "active" / "paused" / "archived" |
| main_topics | text[] | массив ключевых тем |
| current_focus | text | — |
| sessions_count | int | счётчик консультаций |
| last_session_date | date | — |
| deleted_at | timestamptz | soft-delete |
| created_at | timestamptz | — |

#### `client_materials`
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| client_id | UUID | FK → clients.id |
| type | text | "therapist_notes" / "gpt_analysis" / "transcript" / "intake_form" / "document" |
| title | text | — |
| content | text | полный текст материала |
| file_name, file_url | text | если загружен файл |
| consultation_id | UUID | опционально |
| created_at | timestamptz | — |

> `therapist_notes` тип исключается из AI-контекста (приватные заметки).

#### `client_history`
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| client_id | UUID | FK → clients.id |
| section | text | "main_topics" / "hypotheses" / "resources" / "significant_events" / "explored" / "needs_clarification" / "notes" |
| text | text | содержимое записи |
| source | text | откуда добавлено |
| session_id | UUID | опционально |
| created_at | timestamptz | — |

#### `user_profile`
Единственная строка с `id = 'default'`.

| Поле | Тип | Описание |
|---|---|---|
| first_name, last_name, display_name | text | — |
| specialization, approach | text | — |
| email | text | — |
| ai_model | text | выбранная модель (default: "gpt-4o") |
| default_analysis_mode | text | — |
| photo_url | text | — |
| updated_at | timestamptz | — |

#### `consultation_chat_messages`
Создана миграцией 005. Хранит всю историю чата каждой консультации.

| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| consultation_id | UUID NOT NULL | FK → consultations.id (без CASCADE) |
| role | text | "user" / "assistant" |
| content | text | текст сообщения |
| metadata | jsonb | зарезервировано |
| created_at | timestamptz | — |

#### `client_requests`
Создана миграцией 008. История терапевтических запросов клиента. Ровно один `is_current=true` на клиента (partial unique index).

| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| client_id | UUID NOT NULL | FK → clients.id ON DELETE CASCADE |
| text | text NOT NULL | текст запроса |
| is_current | bool | активный запрос клиента |
| source | text | "initial" / "edit" / "new_request" |
| origin_consultation_id | UUID | из какой консультации возник запрос |
| comment | text | комментарий психолога |
| previous_text | text | предыдущая формулировка |
| created_at | timestamptz | — |
| deleted_at | timestamptz | soft-delete |

Атомарные операции через PostgreSQL RPC (migration 009): `set_current_client_request`, `create_current_client_request`.

#### `voice_notes`
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | — |
| duration_sec | int | длительность |
| audio_path | text | путь в Supabase Storage (bucket: voice-notes) |
| text | text | транскрипт заметки |
| client_id | UUID | опционально |
| client_name | text | денормализовано |
| consultation_id | UUID | опционально |
| consultation_title | text | денормализовано |
| deleted_at | timestamptz | soft-delete |
| created_at | timestamptz | — |

> **Внимание:** DAL (`voiceNotes.ts`) читает поле `audio_deleted` (bool), но этого поля нет в `schema.sql` и ни одной из миграций. Supabase возвращает `null`, DAL fallback-ирует в `false`. Необходима отдельная миграция для добавления колонки.

### Схема связей
```
user_profile (singleton)

clients
├── consultations
│   ├── transcript_segments (JSONB в consultations)
│   ├── transcript_formatted (JSONB в consultations)
│   ├── analyses[] (JSONB в consultations)
│   ├── consultation_chat_messages  ← история чата (migration 005)
│   └── request_id → client_requests (migration 010)
├── client_requests                 ← история запросов (migration 008)
├── client_materials
├── client_history
└── voice_notes
```

---

## 6. Supabase Storage

| Bucket | Содержимое | Формат пути | Видимость |
|---|---|---|---|
| `audio` | Аудио консультаций | `{timestamp}-{safeName}.{ext}` | private |
| `voice-notes` | Аудио голосовых заметок | `voice-notes/{filename}` | private |
| `materials` | Загруженные материалы | — | private |

**Внутренний URL-формат:** `storage://audio/{filename}` — хранится в DB, расшифровывается через `lib/supabase/storage.ts`.

**Signed URLs:** используются для скачивания, генерируются на сервере.

**Fallback:** если Supabase Storage недоступен → файл сохраняется в `public/uploads/` (только для локальной разработки).

**Удаление:** при DELETE audio API — файл удаляется из Storage, в DB ставится `audio_deleted_at`. Физическое удаление реализовано.

---

## 7. Жизненный цикл консультации

| Шаг | Статус | Файл |
|---|---|---|
| 1. Создание клиента | ✅ работает | `lib/data/clients.ts` |
| 2. Создание консультации | ✅ работает | через UploadModal |
| 3. Загрузка аудио | ✅ работает | `app/api/upload/route.ts` |
| 4. Сохранение в Supabase Storage | ✅ работает | `lib/supabase/storage.ts` |
| 5. Сжатие FFmpeg | ✅ работает | adaptive bitrate, 16/8 kHz |
| 6. Транскрибация Whisper | ✅ работает | `app/api/transcribe/route.ts` |
| 7. Сохранение Whisper-сегментов | ✅ работает | в `consultations.transcript_segments` (JSONB) |
| 8. Разбивка по ролям (GPT-4o-mini) | ✅ работает | `app/api/format-transcript/route.ts` |
| 9. Сохранение FormattedSegment[] | ✅ работает | в `consultations.transcript_formatted` |
| 10. Таймкоды в репликах | ✅ работает | из WhisperSegment.start/end |
| 11. Клик на таймкод → переход к аудио | ✅ работает | через seekRef в TranscriptPanel |
| 12. Скрытие/показ таймкодов | ✅ работает | localStorage `transcript_show_timestamps` |
| 13. 6 режимов анализа | ✅ работает | `app/api/analyze/route.ts` |
| 14. Хранение нескольких анализов | ✅ работает | JSONB массив `analyses[]` в консультации |
| 15. Переключение между анализами | ✅ работает | вкладки в средней колонке |
| 16. Обновление анализа (force) | ✅ работает | `force=true` в POST /api/analyze |
| 17. Чат с полным контекстом | ✅ работает | `app/api/chat/route.ts` |
| 18. Удаление аудио отдельно | ✅ работает | DELETE `/api/consultations/[id]/audio` |
| 19. Удаление исходного транскрипта | ✅ работает | DELETE `/api/consultations/[id]/transcript-raw` |
| 20. Soft-delete консультации | ✅ работает | `deleted_at` в DB |
| 21. Архивирование консультации | ❌ не реализовано | колонка `archived_at` отсутствует в DB и миграциях |
| 22. Страница архива | ❌ не реализовано | нет страницы |
| 23. Сохранение истории чата в DB | ✅ работает | `app/api/consultations/[id]/chat/route.ts` |
| 24. Запросы клиента (client_requests) | ✅ работает | группировка консультаций по запросу, история запросов |

---

## 8. Транскрибация

**Провайдер:** OpenAI Whisper API, модель `whisper-1`, язык `ru`, формат `verbose_json`

**FFmpeg параметры:**
- Primary: `-ar 16000 -ac 1 -b:a 16k` (16 kHz, mono, 16 kbps)
- Fallback: `-ar 8000 -ac 1 -b:a 8k` (если файл всё ещё > 23 MB)
- Output format: `.mp3`
- Temp files: `/tmp/audio_in_*`, `/tmp/audio_out_*.mp3` — очищаются в finally

**Ограничения:** Whisper API принимает файлы до 25 MB. FFmpeg сжимает до ~7.2 MB/час при 16 kbps.

---

## 9. Таймкоды

| Свойство | Статус |
|---|---|
| Whisper возвращает timestamps | ✅ да (verbose_json) |
| start_seconds/end_seconds сохраняются | ✅ в transcript_segments и transcript_formatted |
| Таймкоды отображаются в репликах | ✅ если showTimestamps=true |
| Клик на таймкод → seek аудиоплеера | ✅ через seekRef.current(sec) |
| Скрытие/показ таймкодов | ✅ localStorage transcript_show_timestamps |
| Старые консультации без сегментов | ⚠️ баннер «таймкоды недоступны» + кнопка пересоздания |

---

## 10. Транскрипт

**Два уровня хранения:**
1. **Исходный текст** (`transcript_text`) — сырой вывод Whisper.
2. **Структурированный** (`transcript_formatted`) — FormattedSegment[] с ролями и таймкодами.

**Приоритет отображения в TranscriptPanel:**
1. `transcriptFormatted` если не пусто → форматированный диалог.
2. `plainText` (`transcript.text`) если нет форматированного.
3. `notes` если нет транскрипта вовсе.

---

## 11. AI-анализ

**Провайдер:** OpenAI (gpt-4o по умолчанию, настраивается в профиле).

**Промпты:** файлы из `knowledge_base/`. Каждый режим → свой набор файлов.

**Что передаётся в модель:**
1. Форматированный транскрипт с ролями (приоритет) или сырой текст.
2. Карточка клиента (имя, возраст, запрос).
3. История клиента (секции из `client_history`).
4. Материалы клиента (исключая `therapist_notes`).
5. Анализы предыдущих консультаций (preview до 400 символов).

**Chunking:** если транскрипт > 20 000 токенов — map-reduce компрессия. Прогресс-индикатор показывает: «Подготавливаю текст для анализа», «Обрабатываю разделы транскрипта», «Формирую анализ».

**ВАЖНО:** этапы прогресса — это chunking уже готового текста из DB, НЕ транскрибация аудио.

**Staleness:** `analysisStale` = true когда добавились новые материалы ИЛИ обновился транскрипт. Скрытие таймкодов и удаление аудио — НЕ делают анализ устаревшим.

**Сохранение:** `analyses[]` JSONB-массив. `force=true` заменяет существующую запись того же `mode`.

---

## 12. Дополнительные виды анализа

| Режим | Файлы knowledge_base |
|---|---|
| working | 01, 02, 04, 05, 06, 08, 11 |
| deep | working + 09 |
| hypothesis | 04, 05, 06, 08 |
| therapist_process | 04, 09, 11 |
| gestalt | 04, 07, 11 |
| next_session | 03, 04, 11 |

**Кнопка `+ АНАЛИЗ`:** реализована в шапке средней колонки. Dropdown с 6 режимами.

**Вкладки:** появляются когда создано 2+ анализов. `displayedMode` управляет что показывается.

**Защита от двойного запуска:** `generatingMode !== null` блокирует параллельный запуск на клиенте. Сервер кэширует (`force=false` → возвращает существующий).

---

## 13. Чат консультации

**Endpoint:** `POST /api/chat` (отправка запроса к AI)

**Персистентность:** история чата сохраняется в Supabase (`consultation_chat_messages`). При открытии консультации ChatPanel загружает историю через `GET /api/consultations/[id]/chat`. После каждого обмена (user+assistant) сохраняет через `POST /api/consultations/[id]/chat`. Очистка: `DELETE /api/consultations/[id]/chat`.

**Контекст, собираемый на сервере (из DB по consultationId):**
- Карточка клиента: имя, возраст, запрос
- Публичные материалы клиента (без `therapist_notes`)
- Транскрипт: `transcript_formatted` или `transcript_text` — до 14 000 символов
- Все анализы: сгруппированы по режиму (last wins), сжато до 8 000 символов суммарно
- Метаданные консультации: название, дата

**Формат ответа AI:** plain text, 2-3 предложения на абзац, пустые строки между абзацами. Настроено в системном промпте + `formatAIResponse()` в ChatPanel как fallback.

**Изоляция:** каждый `consultationId` → своя история в `consultation_chat_messages`. Контекст всегда загружается из DB по ID.

---

## 14. Архивирование и удаление

| Действие | Статус |
|---|---|
| Soft-delete консультации (deleted_at) | ✅ |
| Удаление аудио отдельно | ✅ DELETE /api/consultations/[id]/audio |
| Удаление исходного транскрипта | ✅ DELETE /api/consultations/[id]/transcript-raw |
| Архивирование консультации | ❌ колонка `archived_at` отсутствует в DB и миграциях — не реализовано |
| Страница архива | ❌ не реализована |
| Soft-delete клиента (deleted_at) | ✅ |
| Архивирование клиента (status = "archived") | ⚠️ API есть, UI для просмотра архивных неочевиден |

---

## 15. UI страницы консультации

### Три колонки (flex layout):
```
[Транскрипт] | [AI-анализ] | [Чат]
```

### Левая: Транскрипт
- Вкладки: Транскрипт / Материалы
- Легенда: фиксированная панель (height: 36px, bg: #F5F0E8) над скроллом — НЕ скроллится
- Dropdown «Действия»: закрывается по outside click и Esc
- Поиск по тексту транскрипта
- Кнопка «Разделить по репликам»: запускает /api/format-transcript
- Клик на таймкод: seek в аудиоплеере
- Collapse: сворачивается в узкую панель

### Средняя: AI-анализ
- Шапка (height: 68px, bg: #9C9289)
- Кнопки: «Обновить» (для текущего режима) + «+ АНАЛИЗ» dropdown
- Вкладки режимов: появляются при 2+ анализах
- Stale-баннер: при изменении транскрипта/материалов
- Прогресс: AnalysisProgress с этапами (не транскрибация)

### Правая: Чат
- Подзаголовок: «AI анализирует транскрипт сессии + материалы»
- История: загружается из DB при открытии (GET /api/consultations/[id]/chat), сохраняется в DB после обмена
- История: загружается из DB при открытии, сохраняется в DB после каждого обмена
- Голосовой ввод: Web Speech API (Chrome/Edge)
- Quick prompts: 4 кнопки
- Ответы AI: white-space: pre-wrap, plain text, без Markdown
- Collapse: сворачивается

---

## 16. Переменные окружения

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase проекта |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный ключ (обходит RLS), только в API routes |
| `OPENAI_API_KEY` | OpenAI (Whisper + GPT) для transcribe, analyze, chat |
| `NEXT_PUBLIC_DEMO_MODE` | Показывать mock-данные |

> Anthropic API не используется в production коде.

---

## 17. Railway и деплой

**nixpacks.toml:** устанавливает FFmpeg через apt.

**Timeout:** `export const maxDuration = 300` в тяжёлых route handlers (transcribe, analyze).

**Важно:** файловая система Railway эфемерна. `public/uploads/` и `data/` — НЕ используются в production. Все данные в Supabase.

**Проверки после деплоя:**
1. Открыть существующую консультацию — транскрипт загружается без транскрибации
2. Нажать `+ АНАЛИЗ` → «Гипотезы» — работает без обращения к аудио
3. Написать в чат «Что ты знаешь о клиенте?» — отвечает с именем и запросом
4. Проверить Railway Variables: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 18. Безопасность

| Аспект | Статус |
|---|---|
| Авторизация пользователей | ❌ нет (single-user, no auth) |
| RLS в Supabase | ⚠️ не активирован — используется service role key везде |
| Серверные ключи | ✅ SUPABASE_SERVICE_ROLE_KEY только в API routes |
| Signed URLs для аудио | ✅ через lib/supabase/storage.ts |
| SQL-инъекции | ✅ нет (Supabase client экранирует) |

> Проект не предназначен для multi-user. Безопасность расчитана на single-user private deployment.

---

## 19. Что работает сейчас (подтверждено)

- ✅ Загрузка аудио → FFmpeg → Whisper → транскрипт с сегментами
- ✅ Разбивка транскрипта по ролям (GPT-4o-mini) с сохранением таймкодов
- ✅ Клик на таймкод → переход к месту в аудио
- ✅ Скрытие/показ таймкодов (localStorage)
- ✅ 6 режимов AI-анализа, хранение отдельно, переключение вкладками
- ✅ Кнопка `+ АНАЛИЗ` с dropdown (6 режимов)
- ✅ Чат с полным контекстом (транскрипт + все анализы + карточка клиента) из DB
- ✅ Удаление аудио отдельно от транскрипта
- ✅ Удаление исходного транскрипта
- ✅ Экспорт TXT/MD форматированного транскрипта
- ✅ Supabase DB + Supabase Storage для всех production-данных
- ✅ История клиента по секциям
- ✅ Материалы клиента (therapist_notes исключены из AI-контекста)
- ✅ Голосовые заметки с транскрибацией
- ✅ Настройки профиля и модели AI
- ✅ Collapse/expand всех трёх колонок
- ✅ Легенда транскрипта: фиксированная, не скроллится
- ✅ Сохранение и загрузка истории чата из Supabase (`consultation_chat_messages`)
- ✅ Запросы клиента (client_requests): история, переключение, auto-attach на новых консультациях
- ✅ Группировка консультаций по запросу (`RequestHistoryDrawer`)
- ✅ Ручная привязка старых консультаций к запросам (PATCH `/api/consultations/[id]`)

---

## 20. Что реализовано частично

| Функция | Что сделано | Чего не хватает |
|---|---|---|
| Архив консультаций | — | Колонка `archived_at` отсутствует в DB — нужна миграция + UI |
| Архив клиентов | status = "archived" в API | UI для просмотра архивных |
| Защита от повторной транскрибации | Статус `transcribing` | Нет атомарной блокировки |

---

## 21. Принятые продуктовые решения

1. Транскрибация выполняется один раз и сохраняется в DB.
2. Открытие готовой консультации НЕ запускает транскрибацию повторно.
3. `transcript_text` и `transcript_formatted` — разные сущности, удаляются отдельно.
4. Таймкоды не удаляются при скрытии — меняется только отображение.
5. Дополнительный анализ НЕ заменяет основной.
6. Дополнительный анализ НЕ запускает транскрибацию — работает только с текстом из DB.
7. Чат использует транскрипт и все анализы, загружая из DB по consultationId.
8. После изменения транскрипта/материалов анализ помечается stale.
9. Скрытие таймкодов и удаление аудио НЕ делают анализ устаревшим.
10. История чата сохраняется в `consultation_chat_messages`. Загружается при открытии, сохраняется после каждого обмена.
11. Провайдеры Anthropic и DeepSeek — mock-реализации.

---

## 22. Следующая рекомендуемая задача

**Начать с:** Лупы (EvidenceLens) в центральной колонке консультации.

**Почему:** `analysis_evidence` уже собирается автоматически в фоне после каждого анализа. Данные есть в DB — нужен только компонент для их отображения.

**Что нужно:**
1. Новый компонент `EvidenceLens` / `EvidencePanel` во вкладках средней колонки
2. Читает из `GET /api/evidence/[id]` (endpoint уже существует)
3. Показывает `repeatedThemes`, `importantQuotes`, `uncertaintyMarkers` в компактном виде
4. Если `isStale` — кнопка «Обновить»

**Про архивирование консультаций:** колонка `archived_at` **не существует** ни в `schema.sql`, ни в миграциях. Перед любой работой по архивированию нужно сначала создать и выполнить миграцию.

**Критерий готовности (Evidence):** открыть консультацию с проведённым анализом → в средней колонке видна вкладка с ключевыми темами и цитатами из транскрипта.

---

## 23. Команды разработчика

```bash
npm install          # установка зависимостей
npm run dev          # локальный запуск
npx tsc --noEmit     # проверка типов
npm run lint         # lint
npm run build        # production build
npm start            # production start
```
