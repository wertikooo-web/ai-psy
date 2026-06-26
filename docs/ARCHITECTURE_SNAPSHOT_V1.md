# Architecture Snapshot V1
> Дата: 2026-06-27  
> Состояние: после внедрения evidence-layer (слой доказательности AI-анализа)  
> Назначение: практический ориентир для нового участника или для возобновления работы через месяц

---

## 1. Краткое резюме

Transcript AI — инструмент для психологов. Принимает аудио сессии или готовые транскрипты, транскрибирует (Whisper), структурирует диалог по спикерам (GPT), запускает AI-анализ с учётом истории клиента.

В последнем этапе добавлен **скрытый слой доказательности** (`AnalysisEvidence`): после каждого AI-анализа в фоне запускается извлечение структурированных речевых признаков из транскрипта. Результат сохраняется в Supabase. UI пока не изменился — данные собираются, но не отображаются.

**Что сделано:** pipeline данных, типы, hybrid-extractor, Zod-валидация, fallback, API endpoints, SQL-миграция.

**Что не реализовано:** UI-слой (иконки 🔍, tooltips, popup с объяснениями), связь evidence с основным анализом (анализ не использует evidence как входные данные), динамика между сессиями.

---

## 2. Текущий pipeline

```
1. Загрузка аудио → POST /api/upload (Supabase Storage)
2. Транскрибация → POST /api/transcribe (Whisper, OpenAI)
                   → transcript_text + transcript_segments (raw Whisper JSON) в Supabase
3. Структурирование → POST /api/format-transcript (GPT)
                      → transcript_formatted (FormattedSegment[]) в Supabase
4. Создание консультации → POST /api/consultations (Supabase, таблица consultations)
5. Запуск AI-анализа → POST /api/analyze
   5a. Собирает clientContext (карточка клиента, история, материалы, прошлые анализы)
   5b. Вызывает generateAnalysis() → lib/analysisService.ts
   5c. Сохраняет результат в analyses[] в Supabase
   5d. В фоне (.then().catch()): buildEvidence() → сохраняет analysis_evidence в Supabase
6. Отображение в UI → RealConsultationView.tsx (три колонки: транскрипт / анализ / чат)
```

**Альтернативный путь (без аудио):** пользователь вставляет готовый транскрипт текстом → шаги 1–3 пропускаются, сразу переходим к шагу 4.

Шаг 5d — **асинхронный и не блокирующий**: ответ на POST /api/analyze возвращается до завершения buildEvidence().

---

## 3. Где живёт AnalysisEvidence

| Что | Файл |
|-----|------|
| TypeScript типы (`AnalysisEvidence`, `ThemeEvidence`, `PhraseEvidence`, `MarkerEvidence`, `EvidenceItem`) | `lib/consultationStore.ts` строки 30–84 |
| Extractor / service | `lib/evidenceService.ts` |
| LLM prompt для извлечения тем/цитат/off-topic/issues | `lib/evidenceService.ts` константа `SYSTEM_PROMPT` строки 199–238 |
| Zod-схемы валидации | `lib/evidenceService.ts` строки 160–193 |
| Programmatic счётчик uncertainty markers | `lib/evidenceService.ts` функция `countUncertaintyMarkers()` строки 73–108 |
| Запуск в фоне после анализа | `app/api/analyze/route.ts` строки 118–133 |
| Ручной запуск / перегенерация | `app/api/evidence/[id]/route.ts` (GET + POST) |
| DAL: чтение из Supabase | `lib/data/consultations.ts` функция `rowToConsultation()`, строка 39 |
| DAL: запись в Supabase | `lib/data/consultations.ts` функция `updateConsultation()`, строка 126 |
| SQL-миграция (добавляет колонку) | `supabase/migrations/004_analysis_evidence.sql` |
| Таблица в Supabase | `consultations` |
| Колонка | `analysis_evidence jsonb` |
| Связь с consultationId | через `source.consultationId` внутри JSON + по первичному ключу `id` таблицы |

**sourceHash:** `sha256(transcriptText)[0..16]` hex. Вычисляется в `transcriptHash()` (`lib/evidenceService.ts:28`). Хранится в `source.sourceHash`. При каждом обращении к GET /api/evidence/[id] текущий хэш пересчитывается и сравнивается — если не совпадают, `isStale: true`.

**Важный нюанс staleness:** `transcriptHash` считается от строки `transcript`, которую строит `analyze/route.ts` (formatted segments → raw text → notes). При сравнении в `GET /api/evidence/[id]` используется другой способ построения текста (`.map(s => s.text).join(" ")`). Это **потенциальное расхождение хэшей** — см. раздел 11.

---

## 4. Структура данных

Реальная структура из `lib/consultationStore.ts`:

```typescript
type AnalysisEvidence = {
  version:     "1.0";
  generatedAt: string;  // ISO timestamp

  source: {
    consultationId:       string;
    transcriptVersion?:   string;      // не заполняется — undefined всегда
    transcriptUpdatedAt?: string;      // передаётся при вызове, опционально
    sourceHash:           string;      // sha256[0..16] от transcript string
    hasSpeakerLabels:     boolean;
    hasTimestamps:        boolean;
  };

  quality: {
    speakerSeparation:  "good" | "partial" | "poor" | "unknown";
    transcriptionNoise: "low" | "medium" | "high" | "unknown";
    notes:              string[];
  };

  repeatedThemes:   ThemeEvidence[];   // LLM
  repeatedPhrases:  PhraseEvidence[];  // LLM
  uncertaintyMarkers: MarkerEvidence;  // CODE (подсчёт) + примеры
  possibleOffTopicAnswers:     EvidenceItem[];  // LLM
  importantQuotes:             EvidenceItem[];  // LLM
  possibleTranscriptionIssues: EvidenceItem[];  // LLM
};

type EvidenceItem = {
  segmentId?:    string;   // "seg-N" или "line-N"
  quote:         string;
  speaker:       "client" | "psychologist" | "unknown";
  startSeconds?: number;
  endSeconds?:   number;
  confidence:    "high" | "medium" | "low";
  reason?:       string;
};

type ThemeEvidence = {
  label:       string;
  occurrences: number;
  evidence:    EvidenceItem[];
  confidence:  "high" | "medium" | "low";
};

type PhraseEvidence = {
  phrase:      string;
  occurrences: number;
  evidence:    EvidenceItem[];
  confidence:  "high" | "medium" | "low";
};

type MarkerEvidence = {
  total:    number;
  examples: EvidenceItem[];
};
```

**Отличия от ТЗ:**

| Пункт ТЗ | Реализовано |
|----------|-------------|
| `source.transcriptVersion` | Поле присутствует в типе, но никогда не заполняется (всегда `undefined`) |
| `source.transcriptUpdatedAt` | Передаётся в `buildEvidence()`, но не передаётся из `analyze/route.ts` (только из `evidence/[id]/route.ts` — тоже не передаётся) |
| `repeatedPhrases` — подсчёт кодом | Обнаружение и подсчёт делегированы LLM, не коду |
| Confidence rules строго по ТЗ | Реализованы в системном промпте как инструкция LLM, не программно |
| `quality` — в ТЗ присутствует | Реализовано |

---

## 5. Новые сущности после внедрения evidence-layer

| Сущность | Тип | Назначение | Файл |
|----------|-----|------------|------|
| `AnalysisEvidence` | TypeScript type | Структура доказательной карты | `lib/consultationStore.ts` |
| `ThemeEvidence` | TypeScript type | Повторяющаяся тема с доказательствами | `lib/consultationStore.ts` |
| `PhraseEvidence` | TypeScript type | Повторяющаяся фраза с доказательствами | `lib/consultationStore.ts` |
| `MarkerEvidence` | TypeScript type | Маркеры неопределённости: счётчик + примеры | `lib/consultationStore.ts` |
| `EvidenceItem` | TypeScript type | Единица доказательства (цитата + метаданные) | `lib/consultationStore.ts` |
| `buildEvidence()` | async function | Главная точка входа в evidence extraction | `lib/evidenceService.ts` |
| `transcriptHash()` | function | sha256[0..16] от текста транскрипта | `lib/evidenceService.ts` |
| `emptyEvidence()` | function (приватная) | Безопасная пустая структура при ошибке | `lib/evidenceService.ts` |
| `countUncertaintyMarkers()` | function (приватная) | Подсчёт маркеров неопределённости кодом | `lib/evidenceService.ts` |
| `buildIndexedLines()` | function (приватная) | Преобразует segments → IndexedLine[] с id | `lib/evidenceService.ts` |
| `UNCERTAINTY_PHRASES` | string[] | Список Russian uncertainty phrases | `lib/evidenceService.ts` |
| `SYSTEM_PROMPT` | string const | LLM prompt для evidence extraction | `lib/evidenceService.ts` |
| `LLMOutputSchema` | Zod schema | Валидация ответа LLM | `lib/evidenceService.ts` |
| `BuildEvidenceInput` | interface | Входные параметры для buildEvidence | `lib/evidenceService.ts` |
| `GET /api/evidence/[id]` | API route | Вернуть evidence + isStale | `app/api/evidence/[id]/route.ts` |
| `POST /api/evidence/[id]` | API route | Перегенерировать evidence вручную | `app/api/evidence/[id]/route.ts` |
| `analysis_evidence jsonb` | DB column | Хранилище AnalysisEvidence в Supabase | `supabase/migrations/004_analysis_evidence.sql` |
| `analysisEvidence?` | field в `StoredConsultation` | Опциональное поле в доменной модели | `lib/consultationStore.ts:136` |
| zod | npm dependency | Валидация LLM-ответа перед сохранением | `package.json` |

---

## 6. Связи между сущностями

```
[Транскрипт в Supabase]
  transcript_text  (raw string)
  transcript_formatted (FormattedSegment[])
         │
         ▼
[lib/evidenceService.ts :: buildEvidence()]
         │
         ├─ CODE: countUncertaintyMarkers() → MarkerEvidence
         │        (сканирует только реплики клиента)
         │
         ├─ LLM: getProvider("openai").generateText()
         │       модель берётся из user profile (gpt-4o по умолчанию)
         │       → raw JSON string
         │
         ├─ PARSE: JSON.parse() → unknown
         │
         ├─ VALIDATE: LLMOutputSchema.safeParse()
         │   если failed → emptyEvidence() (никогда не бросает)
         │
         └─ ASSEMBLE → AnalysisEvidence
                │
                ▼
     [Supabase :: consultations.analysis_evidence]
                │
                ▼
     [GET /api/evidence/[id]]
       возвращает: { evidence, isStale, hasTranscript }
                │
                ▼
     [UI — пока НЕ подключён]
```

**Кто вызывает buildEvidence():**
- `app/api/analyze/route.ts` — в фоне, после сохранения результата анализа (`.then().catch()`)
- `app/api/evidence/[id]/route.ts` — синхронно, по явному POST-запросу (ручная перегенерация)

**При ошибке:** `buildEvidence()` никогда не бросает исключение наружу. Любая ошибка (LLM недоступен, JSON невалиден, Zod failed) возвращает `emptyEvidence()` — структурно корректный объект с пустыми массивами. Ошибка логируется через `console.error`.

---

## 7. Ошибки и fallback

| Сценарий | Поведение | Файл |
|----------|-----------|------|
| LLM вернул невалидный JSON | `JSON.parse` бросает → `emptyEvidence()` возвращается | `lib/evidenceService.ts:306–311` |
| Zod-валидация не прошла | `safeParse().success === false` → `emptyEvidence()` | `lib/evidenceService.ts:314–318` |
| LLM call упал (сеть, ключ) | `catch(err)` → `emptyEvidence()` | `lib/evidenceService.ts:320–324` |
| `buildEvidence` упал в фоне | `.catch(err) → console.error(...)` — основной анализ уже возвращён | `app/api/analyze/route.ts:132` |
| POST /api/evidence/[id] упал | 500 с текстом ошибки | `app/api/evidence/[id]/route.ts:78–83` |
| Нет транскрипта при POST | 400 с сообщением | `app/api/evidence/[id]/route.ts:57–62` |

**Что логируется:**
- `[evidence] consultationId=X JSON parse failed, len=N`
- `[evidence] consultationId=X Zod validation failed: N issues`
- `[evidence] consultationId=X LLM call failed: <error message>`
- `[evidence] consultationId=X transcriptLen=N hasSpeakers=B hasTimestamps=B elapsedMs=N ok=true`
- `[analyze] evidence background build failed: <error>`

**Что НЕ логируется:** полный текст транскрипта, цитаты из JSON, тексты реплик.

---

## 8. Безопасность и приватность

**Что сделано правильно:**
- Транскрипты не логируются (логируется только `transcriptLen` — число)
- Цитаты клиента из LLM-ответа не попадают в логи
- `console.error` при ошибке выводит только `err.message`, не объект
- Supabase Service Role Key используется только на сервере (`lib/supabase/server.ts`)
- `analysis_evidence` хранится в той же строке БД, что и сама консультация — доступ ограничен service role

**Риски, которые остаются:**

| Риск | Уровень | Комментарий |
|------|---------|-------------|
| LLM prompt содержит до 28 000 символов транскрипта, отправляемых в OpenAI API | Средний | Данные клиента уходят в OpenAI. Это соответствует существующей практике (analyse тоже отправляет транскрипт), но стоит зафиксировать явно |
| `emptyEvidence()` логирует в `quality.notes`: "evidence extraction failed..." | Низкий | Видно в Supabase, но не чувствительно |
| `console.error("[api/evidence]", err)` в POST route выводит объект err целиком | Низкий | err может содержать stack trace с путями файлов, но не данные клиента |
| `transcriptVersion` никогда не заполняется | Архитектурный | Нет возможности отследить какая версия транскрипта использовалась |

**Нужно улучшить позже:**
- Добавить передачу `transcriptUpdatedAt` при вызове из `analyze/route.ts`
- Рассмотреть шифрование `analysis_evidence` если требования к приватности ужесточатся

---

## 9. Готовность к следующему этапу (UI с иконками 🔍)

**Данные, уже готовые для tooltip:**

| Данные | Поле | Качество |
|--------|------|----------|
| Повторяющиеся темы с примерами | `repeatedThemes[].label`, `.occurrences`, `.evidence[].quote` | ✅ есть |
| Важные цитаты клиента | `importantQuotes[].quote`, `.reason`, `.confidence` | ✅ есть |
| Маркеры неопределённости — счётчик | `uncertaintyMarkers.total` | ✅ есть (подсчёт кодом) |
| Ответы мимо вопроса | `possibleOffTopicAnswers[].quote`, `.reason` | ✅ есть |
| Оценка качества транскрипта | `quality.speakerSeparation`, `.transcriptionNoise` | ✅ есть |
| segmentId для привязки к конкретной реплике | `EvidenceItem.segmentId` | ✅ есть (формат "seg-N") |
| Временная метка реплики | `EvidenceItem.startSeconds` | ✅ если был formatted transcript |

**Чего не хватает для UI:**

1. **Привязка evidence к конкретному абзацу анализа** — основной AI-анализ возвращает свободный текст, в нём нет меток, к которым можно прикрепить tooltip. Нужно либо структурировать выход анализа, либо матчить evidence к тексту анализа постфактум.
2. **Компонент tooltip/popup** — не существует.
3. **Иконки 🔍 в тексте анализа** — `RealConsultationView.tsx` отображает markdown-текст анализа без разметки под evidence.

**Нужно ли менять основной анализ?** Да, если мы хотим точную привязку иконки к интерпретационному выводу. Сейчас анализ возвращает нечленимый markdown-текст.

**Нужно ли менять формат ответа анализа?** Либо добавить маркеры в промпт (`analysisService.ts`), либо реализовать постфактум-матчинг (evidence → ближайший абзац текста анализа). Второй вариант — без изменений в prompts.

**Можно ли начинать UI-этап?** Да, но с оговоркой: если начинать с постфактум-матчинга (evidence выводится блоком, а не привязано к конкретному предложению анализа), то можно начинать немедленно без изменений в backend.

---

## 10. Что НЕ сделано

- **UI лупы не добавлены** — иконки 🔍 в тексте анализа отсутствуют
- **Popup с объяснением не создан** — компонент не существует
- **Центральная колонка не изменена** — `RealConsultationView.tsx` отображает анализ как раньше
- **`AnalysisEvidence` не используется в UI** — GET /api/evidence/[id] существует, но нигде не вызывается из клиентского кода
- **Основной AI-анализ не использует evidence** — `generateAnalysis()` не принимает и не читает `AnalysisEvidence`
- **`repeatedPhrases` не подсчитываются кодом** — делегировано LLM (см. Отличия от ТЗ)
- **`transcriptUpdatedAt` не передаётся** из `analyze/route.ts` и `evidence/[id]/route.ts`
- **`transcriptVersion` не заполняется** — поле в типе есть, значение всегда undefined
- **Динамика между сессиями** — сравнение evidence разных консультаций не реализовано
- **Docling не подключён** — загрузка PDF/документов в knowledge base через Docling отсутствует
- **RLS в Supabase не настроен** — доступ через service role, авторизация не реализована

---

## 11. Риски и технический долг

**1. Расхождение хэшей между GET /api/evidence и POST /api/analyze**

`analyze/route.ts` строит `transcript` из formatted segments с временными метками и именами спикеров:
```
[00:01] Психолог:\nТекст
```
`GET /api/evidence/[id]` строит текст для хэша как:
```
segments.map(s => s.text).join(" ")
```
Это **разные строки** → разные хэши → evidence будет всегда помечаться как stale после анализа.

**2. `buildEvidence` в фоне не гарантирует завершения**

Если сервер завершится между моментом запуска `.then()` и моментом `updateConsultation`, evidence не сохранится. Railway может завершить serverless function до окончания фоновой задачи.

**3. LLM не использует `response_format: json_object`**

`lib/llm/openai.ts` использует `generateText()` без принудительного JSON-режима OpenAI. Промпт просит JSON, Zod проверяет — но LLM может добавить markdown-обёртку. Этот случай обработан strip-логикой, но не идеально.

**4. Один и тот же model для анализа и evidence**

Evidence извлекается той же моделью, что и основной анализ (берётся из profile). Если пользователь выбрал gpt-4o-mini для экономии — evidence тоже будет на mini. Это намеренно, но стоит задокументировать.

**5. `UNCERTAINTY_PHRASES` может иметь дубликаты**

В массиве строки `"наверное"` встречается дважды. Двойной счёт не критичен, но должен быть исправлен.

**6. emptyEvidence записывается в БД**

При ошибке extraction в фоне `emptyEvidence()` не записывается (`.catch` только логирует). Но при явном POST /api/evidence/[id] ошибка возвращает 500 — `emptyEvidence` в этом случае тоже не пишется. Это корректно.

**Что нужно перепроверить перед UI-этапом:**
- Убедиться что хэши в `analyze/route.ts` и `GET /api/evidence/[id]` вычисляются от одинаковой строки
- Убедиться что SQL-миграция 004 применена в Supabase

---

## 12. Следующий шаг

**Step 2: Evidence Viewer — отображение evidence как блока в центральной колонке**

Рекомендуемый подход без изменений в backend:

1. В `RealConsultationView.tsx` после блока с текстом анализа добавить `EvidencePanel` компонент
2. `EvidencePanel` делает `GET /api/evidence/[id]`, показывает `repeatedThemes`, `importantQuotes`, `uncertaintyMarkers.total`
3. Если `isStale: true` — кнопка "Обновить" (POST /api/evidence/[id])
4. Tooltip при hover на каждом evidence item: `quote`, `reason`, `confidence`, `startSeconds`

Это не требует изменений в `analysisService.ts`, `evidenceService.ts` или схеме данных.

Привязка иконок 🔍 к конкретным абзацам анализа — **Step 3**, после того как Step 2 покажет, что данные читаемы и полезны в UI.

---

*Изучены файлы: `lib/consultationStore.ts`, `lib/evidenceService.ts`, `lib/data/consultations.ts`, `lib/analysisService.ts`, `app/api/analyze/route.ts`, `app/api/evidence/[id]/route.ts`, `supabase/migrations/004_analysis_evidence.sql`, список API routes, список миграций.*
