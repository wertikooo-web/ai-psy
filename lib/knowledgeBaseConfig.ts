/**
 * Client-safe constants — no fs imports.
 * Keep in sync with knowledgeBase.ts.
 */

export const ALWAYS_FILES = new Set([
  "000_CORE_INSTRUCTIONS.md",
  "00_КАРТА_БАЗЫ_ЗНАНИЙ.md",
]);

export const ALL_KB_FILES = new Set([
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
]);

export type FileStatus = "always" | "used" | "unused";

export function getFileStatus(filename: string): FileStatus {
  if (ALWAYS_FILES.has(filename)) return "always";
  if (ALL_KB_FILES.has(filename)) return "used";
  return "unused";
}
