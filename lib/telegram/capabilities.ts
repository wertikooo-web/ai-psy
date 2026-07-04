export type Capability = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  examples: string[];
};

export const BOT_CAPABILITIES: Capability[] = [
  {
    id: "clients",
    title: "Клиенты",
    description: "находить клиентов и открывать их карточки",
    enabled: true,
    examples: ["Покажи всех клиентов", "Найди Васю", "Кто сейчас активен?"],
  },
  {
    id: "consultations",
    title: "Консультации",
    description: "показывать последние и ближайшие консультации",
    enabled: true,
    examples: ["Последняя консультация Анны", "Когда следующая встреча?", "Сколько консультаций было в июне?"],
  },
  {
    id: "search",
    title: "Поиск",
    description: "искать по транскриптам, анализам и заметкам",
    enabled: true,
    examples: ["Найди всё про тревогу", "Что обсуждали с Васей про самостоятельность?"],
  },
  {
    id: "audio",
    title: "Аудио",
    description: "принимать аудио консультаций и отправлять на транскрибацию",
    enabled: true,
    examples: ["Отправьте голосовое или аудиофайл"],
  },
  {
    id: "analytics",
    title: "Аналитика",
    description: "показывать статистику практики: клиентов, консультаций, оплат",
    enabled: true,
    examples: ["Покажи мою статистику", "Сколько активных клиентов?", "Сколько консультаций было в июне?", "Сколько оплат получено за месяц?"],
  },
];

export function getEnabledCapabilities(): Capability[] {
  return BOT_CAPABILITIES.filter((c) => c.enabled);
}

export function getCapabilityById(id: string): Capability | undefined {
  return BOT_CAPABILITIES.find((c) => c.id === id);
}

export function buildCapabilitiesIntroText(): string {
  const enabled = getEnabledCapabilities();
  return [
    "Я помощник TRANSCRIPT AI · PSY.",
    "",
    "Могу:",
    ...enabled.map((c) => `— ${c.description}`),
    "",
    "Можно писать обычными фразами, например:",
    `«${enabled[0]?.examples[0] ?? "Покажи всех клиентов"}»`,
    "или",
    `«${enabled[2]?.examples[0] ?? "Найди всё про тревогу"}».`,
  ].join("\n");
}

const HELP_DETAILS: Record<string, string> = {
  clients: [
    "Можно написать:",
    "— Покажи всех клиентов",
    "— Найди Васю",
    "— Кто сейчас активен?",
  ].join("\n"),
  consultations: [
    "Можно спросить:",
    "— Последняя консультация Анны",
    "— Когда следующая встреча?",
    "— Сколько консультаций было в июне?",
  ].join("\n"),
  search: [
    "Я могу искать по консультациям, анализам и заметкам.",
    "",
    "Напишите запрос прямо здесь:",
    "— Найди всё про тревогу",
    "— Что обсуждали с Васей про самостоятельность?",
    "",
    "На сайте также доступен глобальный поиск через кнопку «Поиск...» в боковом меню или Ctrl+K.",
  ].join("\n"),
  audio: [
    "Отправьте голосовое сообщение или аудиофайл.",
    "Я предложу выбрать клиента и консультацию, после чего отправлю запись на транскрибацию.",
  ].join("\n"),
  analytics: [
    "Можно спросить:",
    "— Открой мою статистику",
    "— Покажи аналитику",
    "— Сколько активных клиентов?",
    "— Сколько клиентов сейчас активны?",
    "— Сколько консультаций было в июне?",
    "— Сколько консультаций за месяц?",
    "— Сколько получено оплат за месяц?",
    "— Сколько консультаций сегодня?",
    "— Сколько неоплаченных консультаций?",
  ].join("\n"),
};

export function getCapabilityHelpText(id: string): string | null {
  return HELP_DETAILS[id] ?? null;
}
