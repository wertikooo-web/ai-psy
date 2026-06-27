# 08 — Multitenant / SaaS

> Статус: **не реализовано**. Целевая версия: v3.

## Текущее состояние

Приложение однопользовательское. Нет авторизации на уровне данных. Supabase RLS включён, но правила тривиальны (нет `user_id` в таблицах).

## Что нужно для мультитенантности

### Уровень данных

Добавить `user_id` (или `organization_id`) в ключевые таблицы:
- `clients`
- `consultations`
- `client_requests`
- `client_history`
- `client_materials`
- `knowledge_base` (если KB будет per-user)

Supabase RLS политики:
```sql
CREATE POLICY "users see own data" ON clients
  FOR ALL USING (user_id = auth.uid());
```

### Уровень приложения

- Аутентификация через Supabase Auth (уже встроена)
- Все DB-запросы автоматически фильтруются через RLS
- `user_id` берётся из JWT-токена сессии, не передаётся в теле запроса

### AI-ключи

Сейчас: один OpenAI API key на всё приложение (env var).
В SaaS: либо один ключ + rate limiting per user, либо пользователь вводит свой ключ.

Рекомендация для v3: пользователь вводит собственный OpenAI API key, хранится encrypted в `user_profile`. Так нет проблемы с TPM-лимитами между пользователями.

### Knowledge Base

Сейчас: общая папка `knowledge-base/` на сервере.
В SaaS: нужно per-user хранение. Варианты:
- Supabase Storage с папками `{user_id}/knowledge-base/`
- Отдельная таблица `knowledge_base_files (user_id, name, content, ...)`

## Риски перехода

1. **Миграция данных**: все существующие записи без `user_id` нужно привязать к первому пользователю
2. **RLS и server-side запросы**: `supabaseServer` с service_role обходит RLS — нужен переход на `supabaseClient` с user JWT
3. **Знания в `knowledge-base/` директории**: сейчас это файловая система, не БД — нужна миграция

## Что можно заложить уже сейчас

- Проектировать новые таблицы (`client_requests` и др.) с колонкой `user_id NULLABLE` — в однопользовательском режиме `NULL`, в SaaS будет заполняться
- Не хардкодить пути к файлам KB — через конфигурацию
