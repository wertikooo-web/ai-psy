# 04 — Client Case Model

## Сущности и связи

```
clients
  └── client_history        (структурированная история: темы, гипотезы, ресурсы...)
  └── client_materials      (документы: старые анализы, транскрипты, наблюдения...)
  └── client_requests       (история запросов — v2, см. 05_REQUEST_HISTORY.md)
  └── consultations
        └── transcript      (raw text или whisper-сегменты)
        └── transcriptFormatted (размеченный диалог с таймкодами)
        └── analyses[]      (jsonb-массив: каждый элемент = один режим анализа)
        └── analysisEvidence (речевые паттерны, кэш)
        └── compressedTranscript (map-reduce кэш, инвалидируется по hash)
        └── chat_messages   (история чата по этой консультации)
```

## Приоритет источников транскрипта

При запуске анализа:
1. `transcriptFormatted` — сегменты с таймкодами и разметкой спикеров (приоритет)
2. `transcript.text` — plain text
3. `notes` — заметки психолога (с маркером `[КОНТЕКСТ: ...]` в prompt)

## Статусы консультации

```
created → transcribing → ready → analyzing → done
                    ↑                   ↓
                    └───── retry ────────┘
```

## Тип материалов (client_materials)

```typescript
type: 'general_history' | 'therapist_notes' | 'gpt_analysis' |
      'past_transcript' | 'other' | 'observation'
```

`therapist_notes` — НЕ передаётся в AI (приватные заметки психолога).
Остальные — передаются через `assembleClientContext`, до 10 штук, обрезка до 2 000 символов.

## Наблюдения (observations)

Наблюдения хранятся как `client_materials` с `type = 'observation'`.
Создаются через `ObservationModal`, доступны из любой консультации.
Реал-тайм обновление через `CustomEvent('observation-created')`.

## client_history — секции

```
main_topics         Основные темы
hypotheses          Гипотезы
resources           Ресурсы
significant_events  Значимые события
explored            Проработано
needs_clarification Требует прояснения
notes               Заметки
```

Передаётся в AI как часть clientContext (сгруппировано по секциям).

## Что не передаётся в AI никогда

- `therapist_notes` из client_materials
- Полный текст всех предыдущих анализов (только последние 2, обрезанные)
- Системные поля (id, deleted_at, хэши...)
