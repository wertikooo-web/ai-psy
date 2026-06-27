# NEXT STEPS — TRANSCRIPT AI · PSY
> Обновлено: 2026-06-27. Актуальный список задач. Детальный контекст — в project_state.md.

---

## Начать отсюда

Перед началом новой сессии:
1. Прочитать `project_state.md` (раздел «Что работает сейчас» + «Следующая рекомендуемая задача»)
2. Проверить, что `OPENAI_API_KEY` установлен в Railway Variables
3. Запустить `npx tsc --noEmit` — убедиться что нет TypeScript ошибок

---

## Обязательно: SQL миграции (запустить в Supabase Dashboard → SQL Editor)

- [ ] **003_user_profile_ai_settings.sql** — добавляет analysis_style, analysis_length, chat_style, ai_instructions в user_profile
- [ ] **004_analysis_evidence.sql** — добавляет колонку `analysis_evidence jsonb` в consultations
- [x] **005_chat_messages.sql** ✓ — создаёт таблицу `consultation_chat_messages` (нужно запустить если не запускали)
- [x] **006_compressed_transcript.sql** ✓ — `compressed_transcript jsonb` в consultations
- [x] **007_client_materials_consultation_id.sql** ✓ — `consultation_id` в client_materials
- [ ] **008_client_requests.sql** — создаёт таблицу `client_requests`, мигрирует clients.concern
- [ ] **009_rpc_client_requests.sql** — RPC функции для атомарных операций с запросами
- [ ] **010_consultations_request_id.sql** — добавляет `request_id uuid FK` в consultations

> Миграции 005-010 существуют в `supabase/migrations/` но выполнение в production нужно проверить отдельно.

---

## Следующая задача: Лупы в центральной колонке

**Контекст:** analysis_evidence теперь собирается автоматически после каждого анализа. Следующий шаг — использовать эти данные для отображения «лупы» (инсайтов) в центральной колонке консультации.

- [ ] **Компонент EvidencePanel или EvidenceLens**
  - Встраивается в среднюю колонку (сейчас там только анализы)
  - Показывает repeatedThemes, importantQuotes и т.д. в компактном виде
  - Источник данных: GET /api/evidence/[consultationId]
  - Если isStale — показывать кнопку «Обновить»
  - Файлы: `components/consultation/RealConsultationView.tsx`, новый компонент

---

## P0 — Нет блокеров

Основной flow работает. Нет задач уровня P0.

---

## P1 — Важный функционал

- [x] **analysis_evidence скрытый слой** ✓ ВЫПОЛНЕНО 2026-06-26
  - `lib/evidenceService.ts` — buildEvidence() из текста транскрипта
  - `app/api/evidence/[id]/route.ts` — GET + POST
  - Автозапуск в фоне после каждого анализа (analyze/route.ts)
  - SQL миграция: `004_analysis_evidence.sql` (нужно запустить вручную)
  - Типы: EvidenceItem, AnalysisEvidence в consultationStore.ts

- [x] **Сохранение истории чата в DB** ✓ ВЫПОЛНЕНО
  - Таблица `consultation_chat_messages` (migration 005)
  - `lib/data/chatMessages.ts` — getChatMessages, saveChatMessages, clearChatMessages, getChatMessageCounts
  - `app/api/consultations/[id]/chat/route.ts` — GET/POST/DELETE
  - ChatPanel загружает историю при открытии, сохраняет после каждого обмена

- [x] **Запросы клиента (client_requests)** ✓ ВЫПОЛНЕНО
  - Таблица `client_requests` (migration 008) + RPC функции (migration 009)
  - `request_id` FK в consultations (migration 010)
  - `RequestHistoryDrawer` — история консультаций по запросу
  - `ClientRequestBlock` — управление запросами в карточке клиента
  - Auto-attach `request_id` при создании новой консультации

- [ ] **Защита от двойного запуска транскрибации**
  - При старте транскрибации: проверять `status = 'transcribing'` в DB и отклонять второй запрос
  - Файл: `app/api/transcribe/route.ts`

---

## P2 — Улучшения

- [x] **Страница настроек: аккордеон** ✓ ВЫПОЛНЕНО 2026-06-26
  - Все разделы (Профиль, AI, Интерфейс, Транскрибация, База знаний, Данные) свёрнуты по умолчанию
  - Единый компонент SettingsSection с aria-expanded

- [x] **Настройки AI упрощены** ✓ ВЫПОЛНЕНО 2026-06-26
  - Единый блок: модель, стиль анализа, объём, стиль чата, инструкция
  - Применяется ко всем новым анализам через profile

- [ ] **Страница архива консультаций** (отложено — сначала нужна миграция для колонки `archived_at`, которая отсутствует в DB)

- [ ] **Редактирование транскрипта вручную**
  - Inline-редактирование реплик в TranscriptPanel
  - Сохранение изменений в `transcript_formatted` в DB

- [ ] **Экспорт анализов**
  - Кнопка «Скачать анализ» (TXT или MD) в средней колонке

- [ ] **Mobile-адаптивность**
  - Три колонки сейчас только для desktop

---

## P3 — Когда-нибудь

- [ ] Страница со всеми консультациями (сейчас только через карточку клиента)
- [ ] Поиск по всем транскриптам
- [ ] Уведомления об ошибках транскрибации без перезагрузки (polling или SSE)
- [ ] Экспорт всего клиентского досье в PDF
- [ ] RLS в Supabase (если появится авторизация)
