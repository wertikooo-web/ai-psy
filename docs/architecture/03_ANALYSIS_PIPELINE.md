# 03 — Analysis Pipeline

## Полный путь запроса анализа

```
UI: кнопка "+ АНАЛИЗ"
  → POST /api/analyze { consultationId, mode, force }
    → getConsultation()                          — загрузка данных
    → assembleClientContext()                    — параллельные DB-запросы
    → canonicalTranscriptText() + transcriptHash() — нормализация
    → [если нужно] buildCompressedTranscript()  — map-reduce сжатие
    → generateAnalysis()                         — основной LLM-вызов
    → extractBlocks()                            — второй LLM-вызов
    → updateConsultation({ analyses, status })   — сохранение
  ← { id, result, blocks, mode, model }
UI: рендер AnalysisRenderer + EvidenceTooltip
```

## Кэш compressedTranscript

```
needsChunking = length(canonicalText) / 1.5 > 8 000

if needsChunking:
  storedHash == currentHash → HIT  (нет LLM-вызовов, нет sleep)
  storedHash != currentHash → MISS (map-reduce + sleep 12s + SAVE)
else:
  SKIP
```

Логи: `[analyze] mode=X compressedTranscript=HIT|MISS|SKIP|SAVED`

## Evidence

Извлечение речевых паттернов (`analysisEvidence`) — отдельный процесс, запускается параллельно с `generateAnalysis` через `Promise.all`.

Кэш invalidation: тот же `sourceHash` что и у compressedTranscript. Если transcript не менялся — evidence переиспользуется.

Evidence используется в `EvidenceTooltip` — объяснение почему AI сделал конкретный вывод.

## Обработка ошибок

- 429 (TPM overflow): предотвращается динамическим guard'ом. Если всё же пришёл — статус консультации сбрасывается в `ready`, пользователь может повторить.
- Ошибка extractBlocks: не блокирует. Возвращается пустой массив `blocks: []`, анализ всё равно сохраняется.
- Ошибка сохранения compressedTranscript: не блокирует. Логируется, следующий запрос перестроит.

## Форматирование вывода

`UNIVERSAL_FORMAT_RULES` (в `lib/knowledgeBase.ts`) — единые правила для всех режимов:
- `##` для заголовков разделов
- `**жирный**` для ключевых терминов и меток
- Списки через `–` (не `*`)
- Абзацы через пустую строку

Renderer в UI (`AnalysisRenderer`) интерпретирует markdown. Не нужно менять правила в каждом режиме отдельно.

## Константы (актуальные)

```typescript
TPM_LIMIT                = 30_000
TPM_SAFE_LIMIT           = 27_000
PROMPT_CHARS_PER_TOKEN   = 4        // для измерения assembled prompt
TOKEN_BUDGET_PER_REQUEST = 8_000    // порог chunking (токены)
CHARS_PER_TOKEN          = 1.5      // для chunking threshold (транскрипты)
CHUNK_CHARS              = 12_000   // символов на чанк
TRANSCRIPT_STATIC_CAP_CHARS = 12_000 // первичный cap до сборки prompt
```

## Что нельзя менять без осторожности

- `CHARS_PER_TOKEN` (1.5) и `PROMPT_CHARS_PER_TOKEN` (4) — разные константы с разными назначениями. Не унифицировать.
- sleep(12 000) внутри `buildCompressedTranscript` — убирать нельзя без измерений TPM.
- `Promise.all` для `generateAnalysis + buildEvidence` — не разбивать на последовательные вызовы (потеря ~8–15s).
