# 05 — Request History (История запросов клиента)

> Статус: **спроектировано, не реализовано**. Целевая версия: v2.

## Проблема

Поле `clients.concern` — статичная строка. В реальной практике запрос клиента меняется. Нельзя затирать старый запрос: он связан с уже проведёнными консультациями и анализами.

## Решение: таблица `client_requests`

```sql
client_requests
  id                     uuid PK
  client_id              uuid FK → clients(id)
  text                   text NOT NULL
  is_current             boolean NOT NULL DEFAULT false
  source                 text CHECK IN ('initial', 'refinement', 'new_topic')
  origin_consultation_id uuid FK → consultations(id) NULLABLE
  comment                text NULLABLE
  created_at             timestamptz NOT NULL DEFAULT now()
  deleted_at             timestamptz NULLABLE

UNIQUE INDEX ON client_requests (client_id) WHERE is_current = true AND deleted_at IS NULL
```

**Инвариант:** ровно одна запись с `is_current = true` на `client_id`.

## Два действия — разная семантика

### "Уточнить формулировку" (refinement)
Смысл не изменился, только текст:
```sql
UPDATE client_requests SET text = 'новая формулировка', source = 'refinement'
WHERE id = <current_id>
```
История не создаётся. `request_id` в консультациях не меняется.

### "Новый запрос" (new_topic)
Изменилась тема работы:
```sql
BEGIN
  UPDATE client_requests SET is_current = false
    WHERE client_id = X AND is_current = true;
  INSERT INTO client_requests (client_id, text, is_current, source, origin_consultation_id, comment)
    VALUES (X, 'новый запрос', true, 'new_topic', <текущая консультация>, <комментарий>);
COMMIT
```

## Привязка консультаций

```sql
consultations
  + request_id  uuid FK → client_requests(id) ON DELETE SET NULL  NULLABLE
```

**Nullable** — старые консультации без привязки. Не блокировать анализ, но логировать предупреждение.

При создании новой консультации:
```sql
SELECT id FROM client_requests WHERE client_id = X AND is_current = true LIMIT 1
```

## Привязка анализов

Анализы хранятся как `jsonb[]` в `consultations.analyses`. Добавить поле в каждый элемент:
```json
{
  "id": "...",
  "mode": "working",
  "result": "...",
  "request_id": "uuid-запроса-на-момент-генерации",
  "created_at": "..."
}
```

Берётся из `consultation.request_id` в момент запуска анализа.

**Старые анализы НЕ пересоздаются.** Они остаются срезом понимания на тот момент.

## AI-prompt: что передавать

```
Запрос этой консультации:
[text из client_requests WHERE id = consultation.request_id]

История запросов клиента (кратко):
1. Трудности в общении с девушками  (встречи 1–2)
2. Выбор профессии и давление родителей  (с встречи 3, текущий)

Контекст по этому запросу (предыдущие консультации):
[последние 2 анализа WHERE request_id = consultation.request_id, обрезка до 400 символов]
```

Анализы из других запросов — **не передавать** (v1).
Cap: не более 5 запросов в историю (даже если их 20).

## UI

```
┌─────────────────────────────────────────────┐
│ ЗАПРОС КЛИЕНТА                              │
│                                             │
│ Выбор профессии и давление родителей        │
│ С 3-й встречи · 3 консультации              │
│                                             │
│ [Уточнить формулировку]  [Новый запрос]     │
├─────────────────────────────────────────────┤
│ ▶ Предыдущие запросы (2)                    │
└─────────────────────────────────────────────┘
```

При раскрытии — хронологический список (от первого к последнему):

```
1. Трудности в общении с девушками
   Встречи 1–2 · 2 консультации · 5 анализов          [→]

2. Выбор профессии... (текущий)
   С встречи 3 · 3 консультации · 7 анализов           [→]
```

Клик [→] — drawer с фильтрацией таба "Консультации" по `request_id`. Отдельная страница не нужна.

## Миграция старых данных

1. Для каждого клиента с непустым `concern`:
   ```sql
   INSERT INTO client_requests (client_id, text, is_current, source, created_at)
   SELECT id, concern, true, 'initial', created_at FROM clients WHERE concern IS NOT NULL AND concern != ''
   ```
2. Обновить `clients` — обнулить `concern` (или оставить как read-only legacy).
3. `consultations.request_id` для старых записей остаётся NULL — это ожидаемо.

## Риски

| Риск | Митигация |
|------|-----------|
| Race condition на `is_current` | Partial UNIQUE INDEX на уровне БД |
| Анализ без `request_id` | Логировать, не блокировать |
| Ошибочный "Новый запрос" | Кнопка "Отменить" если нет привязанных консультаций |
| Дата запроса ≠ дата консультации | Использовать `origin_consultation_id`, не `created_at` |
| Потеря `concern` при миграции | Транзакция, резервная копия перед миграцией |
