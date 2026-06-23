# Transcript AI — PSY

MVP-приложение для психологов. Загрузи аудио консультации — получи транскрипт и AI-анализ с учётом профессиональной базы знаний.

## Возможности

- Загрузка аудиофайлов консультаций
- Просмотр транскриптов
- AI-анализ в нескольких режимах: рабочий, глубокий, гештальт, процесс психолога
- База знаний из 12 профессиональных документов
- Поддержка OpenAI GPT-4o (Anthropic и DeepSeek — в разработке)

## Стек

- [Next.js 15](https://nextjs.org/) (App Router)
- TypeScript
- Tailwind CSS
- OpenAI SDK

## Запуск локально

### 1. Клонировать репозиторий

```bash
git clone <repo-url>
cd transcript-ai-psy
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

```bash
cp .env.example .env.local
```

Открой `.env.local` и вставь свой OpenAI API ключ:

```
OPENAI_API_KEY=sk-proj-...
```

Ключ можно получить на [platform.openai.com](https://platform.openai.com/api-keys).

### 4. Создать папку для данных

```bash
mkdir data
echo "[]" > data/consultations.json
mkdir -p public/uploads
```

### 5. Запустить dev-сервер

```bash
npm run dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000).

## Структура проекта

```
app/                    # Next.js App Router (страницы и API routes)
components/             # React-компоненты
lib/                    # Утилиты: анализ, LLM-провайдеры, база знаний
knowledge_base/         # 12 профессиональных .md файлов для AI-анализа
data/                   # Локальная БД (gitignored — создаётся вручную)
public/uploads/         # Загруженные аудиофайлы (gitignored)
```

## API ключи

- `.env.local` — **никогда** не попадает в git (добавлен в `.gitignore`)
- `.env.example` — шаблон без секретов, безопасно хранить в репозитории
- Реальные ключи хранятся только локально

## Режимы AI-анализа

| Режим | Описание |
|---|---|
| `working` | Рабочий разбор — основные паттерны, гипотезы, следующие шаги |
| `deep` | Глубокий анализ — эмоции, речь, отношения, интервенции |
| `therapist_process` | Анализ работы психолога |
| `gestalt` | Гештальт-режим |

## Статус проекта

MVP в разработке. Транскрипция (Whisper) и чат с AI — следующие этапы.
