import path from "path";
import fs from "fs/promises";
import type { PreparedAnalysisEvidence } from "@/lib/analysisBlocks";
import { evidenceToPromptSection } from "@/lib/analysisBlocks";

// ── Types ────────────────────────────────────────────────────────────────────

export type AnalysisMode = "working" | "deep" | "therapist_process" | "gestalt" | "hypothesis" | "next_session";

export interface AnalysisPromptInput {
  mode: AnalysisMode;
  transcript: string;
  clientContext?: string;
  styleHint?: "professional" | "simple" | "academic";
  lengthHint?: "brief" | "standard" | "detailed";
  extraInstructions?: string;
  preparedEvidence?: PreparedAnalysisEvidence;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KB_DIR = path.join(process.cwd(), "knowledge_base");

/**
 * Always loaded first, for every mode.
 * Order matters: core instructions → map → mode-specific files.
 */
const ALWAYS_FILES: string[] = [
  "000_CORE_INSTRUCTIONS.md",
  "00_КАРТА_БАЗЫ_ЗНАНИЙ.md",
];

// ── Mode file lists (must NOT include ALWAYS_FILES — they're prepended automatically) ──

const WORKING_FILES: string[] = [
  "01_МЕТОДИКА_АНАЛИЗА_ПСИХОЛОГИЧЕСКОЙ_КОНСУЛЬТАЦИИ.md",
  "02_ШАБЛОНЫ_РАБОТЫ_ПСИХОЛОГА_С_ТРАНСКРИПТОМ.md",
  "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
  "05_ПРИОРИТЕТЫ_АНАЛИТИЧЕСКОГО_ВНИМАНИЯ.md",
  "06_РАБОТА_С_ГИПОТЕЗАМИ.md",
  "08_ЧТО_МОЖЕТ_БЫТЬ_БОЛЕЕ_ПРОСТЫМ_ОБЪЯСНЕНИЕМ.md",
  "11_КУДА_МОЖНО_КОПНУТЬ_ЕЩЁ.md",
];

const MODE_ONLY_FILES: Record<AnalysisMode, string[]> = {
  working: WORKING_FILES,

  deep: [
    ...WORKING_FILES,
    "09_АНАЛИЗ_ТЕРАПЕВТИЧЕСКОГО_ПРОЦЕССА.md",
  ],

  therapist_process: [
    "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
    "09_АНАЛИЗ_ТЕРАПЕВТИЧЕСКОГО_ПРОЦЕССА.md",
    "11_КУДА_МОЖНО_КОПНУТЬ_ЕЩЁ.md",
  ],

  gestalt: [
    "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
    "07_ГЕШТАЛЬТ_РЕЖИМ.md",
    "11_КУДА_МОЖНО_КОПНУТЬ_ЕЩЁ.md",
  ],

  hypothesis: [
    "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
    "05_ПРИОРИТЕТЫ_АНАЛИТИЧЕСКОГО_ВНИМАНИЯ.md",
    "06_РАБОТА_С_ГИПОТЕЗАМИ.md",
    "08_ЧТО_МОЖЕТ_БЫТЬ_БОЛЕЕ_ПРОСТЫМ_ОБЪЯСНЕНИЕМ.md",
  ],

  next_session: [
    "03_ГОРЯЧИЕ_КНОПКИ.md",
    "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
    "11_КУДА_МОЖНО_КОПНУТЬ_ЕЩЁ.md",
  ],
};

// ── File registry (for ALL_KNOWLEDGE_FILES export) ───────────────────────────

export const ALL_KNOWLEDGE_FILES = [
  "000_CORE_INSTRUCTIONS.md",
  "00_КАРТА_БАЗЫ_ЗНАНИЙ.md",
  "01_МЕТОДИКА_АНАЛИЗА_ПСИХОЛОГИЧЕСКОЙ_КОНСУЛЬТАЦИИ.md",
  "02_ШАБЛОНЫ_РАБОТЫ_ПСИХОЛОГА_С_ТРАНСКРИПТОМ.md",
  "03_ГОРЯЧИЕ_КНОПКИ.md",
  "04_СТИЛЬ_АНАЛИТИЧЕСКОГО_РАЗБОРА.md",
  "05_ПРИОРИТЕТЫ_АНАЛИТИЧЕСКОГО_ВНИМАНИЯ.md",
  "06_РАБОТА_С_ГИПОТЕЗАМИ.md",
  "07_ГЕШТАЛЬТ_РЕЖИМ.md",
  "08_ЧТО_МОЖЕТ_БЫТЬ_БОЛЕЕ_ПРОСТЫМ_ОБЪЯСНЕНИЕМ.md",
  "09_АНАЛИЗ_ТЕРАПЕВТИЧЕСКОГО_ПРОЦЕССА.md",
  "11_КУДА_МОЖНО_КОПНУТЬ_ЕЩЁ.md",
] as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the FULL ordered file list for a mode:
 * ALWAYS_FILES + mode-specific files (no duplicates).
 */
export function getKnowledgeFilesForMode(mode: AnalysisMode): string[] {
  const modeFiles = MODE_ONLY_FILES[mode] ?? MODE_ONLY_FILES.working;
  // Deduplicate: ALWAYS_FILES take the leading positions
  const alwaysSet = new Set(ALWAYS_FILES);
  const unique = modeFiles.filter((f) => !alwaysSet.has(f));
  return [...ALWAYS_FILES, ...unique];
}

/** Reads a specific list of Markdown files and returns their concatenated content. */
export async function loadKnowledgeFiles(files: string[]): Promise<string> {
  const contents = await Promise.all(
    files.map(async (filename) => {
      const filePath = path.join(KB_DIR, filename);
      try {
        const text = await fs.readFile(filePath, "utf-8");
        return `\n\n---\n## [${filename}]\n\n${text.trim()}`;
      } catch {
        console.warn(`[knowledgeBase] Missing file: ${filename}`);
        return `\n\n---\n## [${filename}]\n\n(файл не найден)`;
      }
    })
  );
  return contents.join("");
}

/**
 * Builds a complete LLM prompt.
 *
 * Order:
 *   1. 000_CORE_INSTRUCTIONS.md      ← always, from ALWAYS_FILES
 *   2. 00_КАРТА_БАЗЫ_ЗНАНИЙ.md       ← always, from ALWAYS_FILES
 *   3. mode-specific KB files
 *   4. clientContext                 ← optional
 *   5. transcript
 *   6. task instruction (mode label)
 */
export async function buildAnalysisPrompt(input: AnalysisPromptInput): Promise<string> {
  const { mode, transcript, clientContext, styleHint, lengthHint, extraInstructions, preparedEvidence } = input;

  const files = getKnowledgeFilesForMode(mode);
  const knowledge = await loadKnowledgeFiles(files);

  const modeLabel: Record<AnalysisMode, string> = {
    working:           "Рабочий (базовый анализ)",
    deep:              "Глубокий (включая терапевтический процесс)",
    therapist_process: "Анализ работы психолога",
    gestalt:           "Гештальт-оптика",
    hypothesis:        "Работа с гипотезами",
    next_session:      "Подготовка к следующей сессии",
  };

  const sections: string[] = [];

  // 1–3: knowledge base (core + map + mode files)
  sections.push(`# База знаний TRANSCRIPT AI · PSY\n\nРежим анализа: **${modeLabel[mode]}**\n${knowledge}`);

  // 4: client context
  if (clientContext?.trim()) {
    sections.push(`# Контекст клиента\n\n${clientContext.trim()}`);
  }

  // 4b: evidence context (compact, optional)
  if (preparedEvidence) {
    sections.push(evidenceToPromptSection(preparedEvidence));
  }

  // 5: transcript
  sections.push(`# Транскрипт сессии\n\n${transcript.trim()}`);

  // 6: task
  const wordTarget: Record<AnalysisMode, string> = {
    working:           "400–700 слов",
    deep:              "900–1500 слов — это глубокий разбор, не сокращай",
    therapist_process: "500–900 слов",
    gestalt:           "500–900 слов",
    hypothesis:        "400–700 слов",
    next_session:      "400–600 слов",
  };

  const styleInstruction: Record<string, string> = {
    professional: "",
    simple:       "\n\nСТИЛЬ: Пиши простым и понятным языком, минимум профессиональных терминов. Формулируй мысли так, чтобы было легко читать без специальной подготовки.",
    academic:     "\n\nСТИЛЬ: Используй строгий академический язык. Аргументируй каждый тезис с опорой на конкретные эпизоды из транскрипта. Используй профессиональную терминологию.",
  };

  const lengthInstruction =
    lengthHint === "brief"
      ? "КРАТКИЙ — до 300 слов. Только самое существенное, без развёрнутых пояснений."
      : lengthHint === "detailed"
        ? `ПОДРОБНЫЙ — ${wordTarget[mode]} и более. Развёрнутые обоснования, все значимые наблюдения.`
        : wordTarget[mode];

  // ── Universal formatting rules — applied to ALL modes ──────────────────────
  // Prompts describe WHAT to produce; this block describes HOW to format it.
  // The renderer (MarkdownRenderer via react-markdown) handles visual styling
  // for ##, **bold**, - lists, 1. numbered lists consistently across all modes.
  const UNIVERSAL_FORMAT_RULES = [
    `# Правила оформления (обязательны для всех режимов)`,
    ``,
    `Используй Markdown. Эти правила применяются во всех режимах анализа одинаково.`,
    ``,
    `## Заголовки разделов`,
    `Каждый смысловой раздел начинается с заголовка второго уровня: ## Название раздела`,
    ``,
    `## Жирные метки`,
    `Именованные типы блоков (Наблюдение, Гипотеза, Рекомендация, Фокус и т.п.) пишутся жирным с двоеточием: **Метка:** текст`,
    ``,
    `## Абзацы`,
    `Каждый абзац — максимум 2–3 предложения. Между абзацами — пустая строка.`,
    `Длинные полотна текста без переносов недопустимы.`,
    ``,
    `## Списки`,
    `Перечисления — маркированным списком (- пункт).`,
    `Нумерованные пункты — только когда важен порядок (1. пункт).`,
    ``,
    `## Что запрещено`,
    `Не использовать HTML-теги. Не писать сплошным текстом без структуры.`,
    `Не дублировать заголовок режима в тексте — он уже показан в интерфейсе.`,
  ].join("\n");

  sections.push(UNIVERSAL_FORMAT_RULES);

  // ── Mode-specific content instruction ───────────────────────────────────────
  // Each mode describes WHAT structure and content to produce.
  // Formatting is handled by UNIVERSAL_FORMAT_RULES above.

  const modeContentInstruction: Record<AnalysisMode, string> = {
    working: [
      `Прочитай транскрипт и сформулируй аналитический разбор в соответствии с базой знаний.`,
      `Выдели ключевые темы, паттерны и динамику. Разбей на смысловые разделы с заголовками.`,
      `Голос: думающий коллега-супервизор. Опирайся только на то, что есть в тексте.`,
    ].join("\n"),

    deep: [
      `Выполни глубокий многоуровневый разбор. Не сокращай — это режим максимальной глубины.`,
      `Включи: ключевые темы, защитные паттерны, динамику отношений, процесс терапевта, гипотезы.`,
      `Разбей на разделы. Каждый тезис обоснуй ссылкой на конкретный момент из транскрипта.`,
    ].join("\n"),

    therapist_process: [
      `Проанализируй работу психолога: интервенции, вопросы, реакции, пропущенные моменты.`,
      `Что работало хорошо? Что можно было сделать иначе? Какие динамики возникли в контакте?`,
      `Разбей на разделы: Интервенции, Контакт, Пропущенные моменты, Рекомендации супервизора.`,
    ].join("\n"),

    gestalt: [
      `Посмотри на сессию через гештальт-оптику: фигура и фон, контакт, прерывания, полярности.`,
      `Что присутствует телесно и эмоционально? Где клиент уходит из контакта? Что остаётся незавершённым?`,
      `Разбей на разделы по ключевым гештальт-темам.`,
    ].join("\n"),

    hypothesis: [
      `Сформулируй рабочие гипотезы о клиенте на основе транскрипта.`,
      `Для каждой гипотезы: что именно в тексте её поддерживает, что может опровергать.`,
      `Структура: **Гипотеза:** → **Основание:** → **Альтернативное объяснение:**`,
    ].join("\n"),

    next_session: [
      `Подготовь психолога к следующей встрече с клиентом.`,
      ``,
      `Структура ответа (строго в этом порядке):`,
      ``,
      `Вступление: 2–3 предложения о ключевой теме или динамике этой сессии.`,
      ``,
      `Затем 3–5 пар — каждая пара в отдельном блоке:`,
      `**Наблюдение:** конкретный момент из транскрипта (максимум 2 предложения)`,
      `**Возможная гипотеза:** что за этим может стоять (максимум 2 предложения)`,
      ``,
      `После всех пар — два обязательных раздела:`,
      ``,
      `## Рекомендации к следующей сессии`,
      `Маркированный список конкретных рекомендаций психологу (не клиенту):`,
      `что исследовать, какие гипотезы проверить, на что обратить внимание в контакте, что не упустить.`,
      ``,
      `## Вопросы, которые стоит задать`,
      `Нумерованный список из 5–7 вопросов, которые психолог может задать клиенту.`,
      `Вопросы должны логически вытекать из наблюдений выше.`,
    ].join("\n"),
  };

  const taskText =
    `# Задача\n\n` +
    `Режим: ${modeLabel[mode]}.\n\n` +
    modeContentInstruction[mode] + "\n\n" +
    `Объём: ${lengthInstruction}.` +
    (styleInstruction[styleHint ?? "professional"] ?? "") +
    (extraInstructions?.trim() ? `\n\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПСИХОЛОГА:\n${extraInstructions.trim()}` : "");

  sections.push(taskText);

  return sections.join("\n\n---\n\n");
}
