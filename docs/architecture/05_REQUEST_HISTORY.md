# 05 — Request History (История запросов клиента)

> Статус: **спроектировано, не реализовано**.
> Архитектура согласована: Claude + GPT-review, 2026-06-27.
> Целевая версия: v2. Реализация разбита на два этапа.

---

## Проблема

Поле `clients.concern` — статичная строка. В реальной практике запрос клиента меняется. Нельзя затирать старый запрос: он связан с уже проведёнными консультациями и анализами.

---

## Таблица `client_requests`

```sql
client_requests
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid()
  client_id              uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE
  text                   text        NOT NULL
  previous_text          text        NULLABLE        -- хранит предыдущую формулировку при редактировании
  is_current             boolean     NOT NULL DEFAULT false
  source                 text        NOT NULL        -- см. enum ниже
  origin_consultation_id uuid        NULLABLE REFERENCES consultations(id) ON DELETE SET NULL
  comment                text        NULLABLE        -- пометка психолога о контексте смены запроса
  created_at             timestamptz NOT NULL DEFAULT now()
  updated_at             timestamptz NULLABLE        -- заполняется при source='edit'
  deleted_at             timestamptz NULLABLE

-- Инвариант: ровно один is_current=true на client_id
UNIQUE INDEX ON client_requests (client_id) WHERE is_current = true AND deleted_at IS NULL
```

### Enum `source`

| Значение | Когда используется |
|---|---|
| `initial` | Первый запрос клиента (при создании или миграции из `concern`) |
| `edit` | Психолог уточнил формулировку — смысл тот же, текст изменился |
| `new_request` | Изменилась тема работы — создаётся новая запись |

---

## Два действия — разная логика

### "Уточнить формулировку" → `edit`

Смысл запроса не изменился, только текст. **Новая запись не создаётся.**

```sql
UPDATE client_requests
SET
  previous_text = text,          -- сохраняем старую формулировку
  text          = 'новый текст',
  updated_at    = now(),
  source        = 'edit'
WHERE id = <current_id>
```

- `request_id` в консультациях не меняется
- История запросов не создаётся
- Старая формулировка доступна в `previous_text`

### "Новый запрос" → `new_request`

Изменилась тема работы. **Создаётся новая запись, старая становится архивной.**

```sql
BEGIN;
  UPDATE client_requests
    SET is_current = false
    WHERE client_id = :client_id AND is_current = true;

  INSERT INTO client_requests
    (client_id, text, is_current, source, origin_consultation_id, comment)
  VALUES
    (:client_id, :text, true, 'new_request', :consultation_id, :comment);
COMMIT;
```

- Новые консультации автоматически получат новый `request_id`
- Старые консультации остаются привязаны к прежнему запросу
- Старые анализы **не пересоздаются**

---

## Старое поле `clients.concern` — стратегия перехода

### Принцип: не обнулять сразу

Обнуление `concern` в одной транзакции с миграцией — опасно. Если миграция упадёт или в коде останутся необнаруженные обращения к `concern`, данные потеряются без возможности восстановления.

### Три шага (разные этапы деплоя)

**Шаг 1 — Миграция (этап 1):**
```sql
-- Для каждого клиента с непустым concern создать запись в client_requests
INSERT INTO client_requests (client_id, text, is_current, source, created_at)
SELECT id, concern, true, 'initial', created_at
FROM clients
WHERE concern IS NOT NULL AND concern != '' AND deleted_at IS NULL;
```
`concern` остаётся нетронутым. Два источника данных сосуществуют.

**Шаг 2 — Проверка:**
Убедиться, что все клиенты имеют запись в `client_requests`. Убедиться, что UI использует `client_requests`, а не `concern`. Убедиться, что новые консультации получают `request_id`.

**Шаг 3 — Обнуление (отдельный коммит, после проверки):**
```sql
-- Только после проверки
UPDATE clients SET concern = NULL WHERE id IN (
  SELECT DISTINCT client_id FROM client_requests
);
```
`concern` остаётся в схеме как nullable legacy-поле. Удалять колонку — только в v3+.

---

## Привязка консультаций

```sql
consultations
  + request_id  uuid  NULLABLE  REFERENCES client_requests(id) ON DELETE SET NULL
```

**Nullable** — старые консультации без привязки. Не блокировать анализ, но логировать предупреждение в dev-режиме.

### При создании новой консультации

```typescript
const currentRequest = await db
  .from('client_requests')
  .select('id')
  .eq('client_id', clientId)
  .eq('is_current', true)
  .is('deleted_at', null)
  .single();

// если нет — request_id = null, консультация создаётся без привязки
```

---

## Привязка анализов

Анализы хранятся как `jsonb[]` в `consultations.analyses`. Добавить поле `request_id` в каждый элемент при генерации:

```json
{
  "id": "uuid",
  "mode": "working",
  "result": "...",
  "blocks": [],
  "request_id": "uuid-запроса-на-момент-генерации",
  "created_at": "2026-06-27T..."
}
```

Берётся из `consultation.request_id` в момент вызова `/api/analyze`.

**Старые анализы не пересоздаются.** У них `request_id` будет отсутствовать — это ожидаемое поведение, не ошибка.

---

## AI-prompt: что передавать (этап 2)

```
Запрос этой консультации:
[text из client_requests WHERE id = consultation.request_id]

История запросов клиента:
1. Трудности в общении с девушками  (встречи 1–2)
2. Выбор профессии и давление родителей  (с встречи 3, текущий)

Контекст по этому же запросу (предыдущие консультации):
[последние 2 анализа WHERE request_id = consultation.request_id, до 400 символов каждый]
```

**Ограничения:**
- Не более 5 запросов в истории (cap — даже если их 20)
- Анализы из других запросов — не передавать (v2)
- Анализы по другим запросам — только если явно запрошено (v3)

---

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

При раскрытии — хронологический список от первого к последнему:

```
1. Трудности в общении с девушками
   Встречи 1–2 · 2 консультации · 5 анализов          [→]

2. Выбор профессии... (текущий)
   С встречи 3 · 3 консультации · 7 анализов           [→]
```

Клик [→] — drawer/боковая панель с фильтрацией таба "Консультации" по `request_id`. Отдельная страница не нужна.

---

## План реализации

### Этап 1 — Данные + UI (реализуется первым)

1. Миграция БД: создать `client_requests`
2. Перенести `concern` в `client_requests` (source='initial')
3. Добавить `request_id` в `consultations`
4. При создании новой консультации — автоматически брать текущий `request_id`
5. UI: блок "Запрос клиента" с кнопками "Уточнить" и "Новый запрос"
6. UI: история запросов (свёрнута по умолчанию)
7. Проверить → обнулить `concern` отдельным коммитом

### Этап 2 — Подключение к AI-анализу (после стабилизации этапа 1)

1. В `/api/analyze`: брать `request_id` из консультации
2. Обогатить `assembleClientContext()` историей запросов
3. При генерации анализа: писать `request_id` в jsonb-запись
4. Тестировать что старые анализы (без `request_id`) не ломаются

---

## Риски

| Риск | Описание | Митигация |
|------|----------|-----------|
| Потеря `concern` при миграции | Ошибка в SQL или частичный rollback | Миграция в транзакции; `concern` не обнулять до проверки |
| Два `is_current = true` | Race condition при параллельных запросах | `UNIQUE INDEX WHERE is_current = true AND deleted_at IS NULL` |
| Старые консультации без `request_id` | NULL в поле — не ошибка, но требует обработки в UI и prompt | Явная проверка: не блокировать анализ, логировать предупреждение |
| Анализ без `request_id` | Запущен до этапа 2 или на старой консультации | Поле в jsonb опциональное, отсутствие — ожидаемо |
| "Уточнить" вместо "Новый запрос" | Психолог ошибся с действием | В UI показывать чёткое различие; подсказка "Если изменилась тема — используйте «Новый запрос»" |
| Отсутствие отката "Нового запроса" | Случайно создан новый запрос | Кнопка "Отменить" — только если у нового запроса ещё нет привязанных консультаций |
| Удаление клиента | Осиротевшие записи в `client_requests` | `ON DELETE CASCADE` на `client_id` |
