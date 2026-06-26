import path from "path";
import fs from "fs/promises";

// ── Types ────────────────────────────────────────────────────────────────────

export type AnalysisMode = "working" | "deep" | "therapist_process" | "gestalt" | "hypothesis" | "next_session";

export interface AnalysisPromptInput {
  mode: AnalysisMode;
  transcript: string;
  clientContext?: string;
  styleHint?: "professional" | "simple" | "academic";
  lengthHint?: "brief" | "standard" | "detailed";
  extraInstructions?: string;
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
  const { mode, transcript, clientContext, styleHint, lengthHint, extraInstructions } = input;

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

  const taskText =
    `# Задача\n\n` +
    `Режим: ${modeLabel[mode]}.\n` +
    `Прочитай транскрипт и сформулируй аналитический разбор в соответствии с базой знаний выше.\n` +
    `Используй голос думающего коллеги-супервизора. Опирайся только на то, что есть в тексте.\n` +
    `Формат: связный аналитический текст, разбитый на смысловые блоки с заголовками.\n` +
    `Объём: ${lengthInstruction}.` +
    (styleInstruction[styleHint ?? "professional"] ?? "") +
    (extraInstructions?.trim() ? `\n\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПСИХОЛОГА:\n${extraInstructions.trim()}` : "");

  sections.push(taskText);

  return sections.join("\n\n---\n\n");
}
