# 07 — Performance

## Текущие характеристики

| Операция | Время | Примечание |
|----------|-------|------------|
| Загрузка страницы клиента | ~200–400ms | 4 параллельных DB-запроса |
| Короткий анализ (transcript < 8k токенов) | ~15–25s | 2 LLM-вызова |
| Длинный анализ, первый раз (MISS кэш) | ~60–120s | map-reduce + sleep 12s + 2 LLM |
| Длинный анализ, повторный (HIT кэш) | ~15–25s | 0 compressChunk + 2 LLM |
| Извлечение блоков (extractBlocks) | ~5–10s | параллельно с анализом |

## Оптимизации, уже реализованные

### Параллельные DB-запросы
`assembleClientContext()` использует `Promise.allSettled` для 4 запросов вместо последовательных.
Экономия: ~500–1 400ms.

### compressedTranscript кэш
Map-reduce сжатие выполняется только при изменении транскрипта (invalidation по `sourceHash`).
При HIT: 0 дополнительных LLM-вызовов, 0 sleep.

### Параллельный запуск analysis + evidence
`Promise.all([generateAnalysis(), buildEvidence()])` — экономия ~8–15s.

### Динамический TPM guard
Измерение собранного prompt до отправки в LLM. Trim transcript если `estimatedTotal > 27 000 tokens`.
Предотвращает 429-ошибки без ручных настроек.

## Узкие места (не решены)

### Sleep 12 000ms после chunking
Нужен для восстановления TPM перед основным анализом. Убирать нельзя без тарифного upgrade OpenAI.

### Второй LLM-вызов (extractBlocks)
4 000 токенов, ~5–10s. Нет кэша. При каждом анализе — даже при повторном запуске того же режима.
**Возможная оптимизация:** кэшировать blocks вместе с анализом, не пересчитывать при `force=false`.

### Нет стриминга
Анализ возвращается целиком. Пользователь ждёт до 2 минут без обратной связи.
**Возможная оптимизация:** SSE/streaming из `/api/analyze`, постепенный рендер.

## Масштабирование (100+ клиентов)

- DB-запросы по `client_id` покрыты индексами — без деградации
- Bottleneck будет в OpenAI TPM при параллельных запросах нескольких пользователей
- При SaaS: per-user rate limiting + очередь задач (Bull/BullMQ)

## Мониторинг

Логи анализа содержат:
```
[analyze] mode=X compressedTranscript=HIT|MISS|SKIP|SAVED chunks=N
[analysis] mode=X tokens OK: ~N (input ~N + output ≤N, safe limit 27000)
[analysis] mode=X TPM guard: trimming transcript N → N chars
[compress] N tokens → N chunks
```
