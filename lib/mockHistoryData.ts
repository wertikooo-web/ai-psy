import type { ClientHistoryItem } from "./types";

// Mock history items for demonstration (mock clients c1–c5 only).
// In production these come from /api/client-history/[clientId].
// source: "ai"     = сгенерировано моделью на основе транскрипта
// source: "manual" = добавлено психологом вручную

export const mockHistoryItems: ClientHistoryItem[] = [
  // ── c1 Анна Соколова ────────────────────────────────────────────────────
  {
    id: "h1", clientId: "c1", section: "main_topics", source: "ai", sessionId: "s3",
    text: "Тревога разлучения — ранний формирующий опыт, связанный с непредсказуемостью матери",
    createdAt: "2024-03-10T10:00:00Z",
  },
  {
    id: "h2", clientId: "c1", section: "main_topics", source: "ai", sessionId: "s5",
    text: "Перфекционизм как защитная стратегия: «если я всё сделаю идеально — меня не бросят»",
    createdAt: "2024-04-02T10:00:00Z",
  },
  {
    id: "h3", clientId: "c1", section: "main_topics", source: "manual",
    text: "Сложность с принятием помощи — воспринимает как угрозу автономии",
    createdAt: "2024-04-15T09:30:00Z",
  },
  {
    id: "h4", clientId: "c1", section: "hypotheses", source: "ai", sessionId: "s4",
    text: "Тревожность = реакция на эмоциональную непредсказуемость в детстве, а не черта характера",
    createdAt: "2024-03-20T10:00:00Z",
  },
  {
    id: "h5", clientId: "c1", section: "hypotheses", source: "manual",
    text: "Контроль — инструмент снижения тревоги, а не ценность. Стоит исследовать отдельно",
    createdAt: "2024-04-10T11:00:00Z",
  },
  {
    id: "h6", clientId: "c1", section: "resources", source: "manual",
    text: "Высокая рефлексивность — замечает паттерны и готова их называть",
    createdAt: "2024-02-20T09:00:00Z",
  },
  {
    id: "h7", clientId: "c1", section: "resources", source: "ai", sessionId: "s2",
    text: "Сильная мотивация к изменениям: «я устала так жить» — ресурс для работы",
    createdAt: "2024-02-28T10:00:00Z",
  },
  {
    id: "h8", clientId: "c1", section: "significant_events", source: "manual",
    text: "Развод родителей в 7 лет — переломный момент, после которого появился «контролирующий» паттерн",
    createdAt: "2024-02-15T09:00:00Z",
  },
  {
    id: "h9", clientId: "c1", section: "significant_events", source: "ai", sessionId: "s6",
    text: "Первое серьёзное расставание в 24 года — активировало детскую тревогу брошенности",
    createdAt: "2024-04-25T10:00:00Z",
  },
  {
    id: "h10", clientId: "c1", section: "explored", source: "ai", sessionId: "s3",
    text: "Исследовали связь перфекционизма и страха отвержения — клиент подтвердил паттерн",
    createdAt: "2024-03-10T10:00:00Z",
  },
  {
    id: "h11", clientId: "c1", section: "explored", source: "manual",
    text: "Работали с техникой «безопасное место» — откликается, использует самостоятельно",
    createdAt: "2024-03-25T09:30:00Z",
  },
  {
    id: "h12", clientId: "c1", section: "needs_clarification", source: "manual",
    text: "Прояснить отношения с братом — упоминает вскользь, уходит от темы",
    createdAt: "2024-04-05T09:00:00Z",
  },
  {
    id: "h13", clientId: "c1", section: "needs_clarification", source: "ai", sessionId: "s7",
    text: "Телесные симптомы тревоги — не исследовали, стоит вернуться",
    createdAt: "2024-05-01T10:00:00Z",
  },
  {
    id: "h14", clientId: "c1", section: "notes", source: "manual",
    text: "Лучше работает с метафорами и образами, чем с прямыми вопросами. Избегает «почему»-формулировок",
    createdAt: "2024-02-10T09:00:00Z",
  },
  {
    id: "h15", clientId: "c1", section: "notes", source: "manual",
    text: "Приходит подготовленной — ведёт дневник между сессиями. Полезно просить принести записи",
    createdAt: "2024-03-01T09:00:00Z",
  },

  // ── c2 Михаил Ребров ────────────────────────────────────────────────────
  {
    id: "h20", clientId: "c2", section: "main_topics", source: "ai", sessionId: "s10",
    text: "Выгорание как следствие многолетнего игнорирования собственных потребностей",
    createdAt: "2024-05-10T10:00:00Z",
  },
  {
    id: "h21", clientId: "c2", section: "main_topics", source: "manual",
    text: "Трудности с делегированием — связывает с недоверием («сделают хуже»)",
    createdAt: "2024-05-15T09:00:00Z",
  },
  {
    id: "h22", clientId: "c2", section: "hypotheses", source: "ai", sessionId: "s11",
    text: "Гиперответственность — усвоенная роль «того, кто решает проблемы» в семье происхождения",
    createdAt: "2024-05-20T10:00:00Z",
  },
  {
    id: "h23", clientId: "c2", section: "resources", source: "manual",
    text: "Аналитическое мышление — быстро видит структуру проблемы, когда отступает аффект",
    createdAt: "2024-05-12T09:00:00Z",
  },
  {
    id: "h24", clientId: "c2", section: "needs_clarification", source: "manual",
    text: "Отношения с отцом — практически не упоминает, реагирует напряжением при косвенных вопросах",
    createdAt: "2024-05-25T09:00:00Z",
  },
  {
    id: "h25", clientId: "c2", section: "notes", source: "manual",
    text: "Склонен к интеллектуализации — важно возвращать к телесным ощущениям и эмоциям",
    createdAt: "2024-05-08T09:00:00Z",
  },
];
