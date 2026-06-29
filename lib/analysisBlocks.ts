/**
 * Types and utilities for structured analysis blocks (Step 2).
 *
 * AnalysisBlock wraps one semantic section of the analysis output.
 * Blocks with isInterpretive=true carry explanation + evidenceRefs for the 🔍 UI.
 *
 * The `result` field on an analysis entry remains the canonical markdown text.
 * Blocks are a parallel structure — never shown in old UI.
 */

import { z } from "zod";
import type { AnalysisEvidence } from "@/lib/consultationStore";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvidenceReference = {
  category:
    | "repeatedThemes"
    | "repeatedPhrases"
    | "uncertaintyMarkers"
    | "possibleOffTopicAnswers"
    | "importantQuotes"
    | "possibleTranscriptionIssues";
  evidenceId?: string;
  segmentId?: string;
  startSeconds?: number;
  endSeconds?: number;
  quote?: string;
};

export type AnalysisBlock = {
  id: string;
  title?: string;
  content: string;
  tags?: string[];
  isInterpretive: boolean;
  /** Rich 2–4 sentence explanation: observation + significance + limitation. */
  explanation?: string;
  /** Legacy short-line array — kept for backward compat with pre-explanation analyses. */
  evidenceTooltip?: string[];
  evidenceRefs?: EvidenceReference[];
  confidence?: "high" | "medium" | "low";
};

// ── Compact evidence passed to LLM (avoids sending large JSON) ───────────────

export type PreparedAnalysisEvidence = {
  repeatedThemes:     { label: string; occurrences: number; confidence: string; segmentId?: string; quote?: string }[];
  repeatedPhrases:    { phrase: string; occurrences: number; confidence: string; segmentId?: string }[];
  uncertaintyTotal:   number;
  uncertaintyExamples: { segmentId?: string; quote: string }[];
  offTopicAnswers:    { segmentId?: string; quote: string; reason?: string; confidence: string }[];
  importantQuotes:    { segmentId?: string; quote: string; reason?: string; confidence: string }[];
  qualitySpeaker:     string;
  qualityNoise:       string;
};

export function prepareEvidenceForAnalysis(ev: AnalysisEvidence): PreparedAnalysisEvidence {
  return {
    repeatedThemes: ev.repeatedThemes.slice(0, 5).map((t) => ({
      label:      t.label,
      occurrences: t.occurrences,
      confidence: t.confidence,
      segmentId:  t.evidence[0]?.segmentId,
      quote:      t.evidence[0]?.quote?.slice(0, 100),
    })),
    repeatedPhrases: ev.repeatedPhrases.slice(0, 5).map((p) => ({
      phrase:      p.phrase,
      occurrences: p.occurrences,
      confidence:  p.confidence,
      segmentId:   p.evidence[0]?.segmentId,
    })),
    uncertaintyTotal:    ev.uncertaintyMarkers.total,
    uncertaintyExamples: ev.uncertaintyMarkers.examples.slice(0, 4).map((e) => ({
      segmentId: e.segmentId,
      quote:     e.quote.slice(0, 90),
    })),
    offTopicAnswers: ev.possibleOffTopicAnswers.slice(0, 3).map((e) => ({
      segmentId:  e.segmentId,
      quote:      e.quote.slice(0, 100),
      reason:     e.reason,
      confidence: e.confidence,
    })),
    importantQuotes: ev.importantQuotes.slice(0, 5).map((e) => ({
      segmentId:  e.segmentId,
      quote:      e.quote.slice(0, 120),
      reason:     e.reason,
      confidence: e.confidence,
    })),
    qualitySpeaker: ev.quality.speakerSeparation,
    qualityNoise:   ev.quality.transcriptionNoise,
  };
}

// ── Render evidence context for LLM prompt (compact text section) ─────────────

export function evidenceToPromptSection(ev: PreparedAnalysisEvidence): string {
  const lines: string[] = ["## Наблюдения из транскрипта (автоматически)\n"];
  lines.push("Используй эти данные для проверки устойчивости паттернов.");
  lines.push("Если данные противоречат прочтению транскрипта — доверяй транскрипту.\n");

  if (ev.repeatedThemes.length > 0) {
    lines.push("**Повторяющиеся темы:**");
    for (const t of ev.repeatedThemes) {
      const seg = t.segmentId ? ` (${t.segmentId})` : "";
      const q   = t.quote     ? ` — «${t.quote}»`   : "";
      lines.push(`- ${t.label}: ${t.occurrences}× — уверенность: ${t.confidence}${seg}${q}`);
    }
    lines.push("");
  }

  if (ev.repeatedPhrases.length > 0) {
    lines.push("**Повторяющиеся формулировки:**");
    for (const p of ev.repeatedPhrases) {
      const seg = p.segmentId ? ` (${p.segmentId})` : "";
      lines.push(`- «${p.phrase}»: ${p.occurrences}× — уверенность: ${p.confidence}${seg}`);
    }
    lines.push("");
  }

  if (ev.uncertaintyTotal > 0) {
    lines.push(`**Маркеры неопределённости:** ${ev.uncertaintyTotal} случаев`);
    for (const e of ev.uncertaintyExamples) {
      const seg = e.segmentId ? ` [${e.segmentId}]` : "";
      lines.push(`  • «${e.quote}»${seg}`);
    }
    lines.push("");
  }

  if (ev.importantQuotes.length > 0) {
    lines.push("**Значимые фрагменты:**");
    for (const q of ev.importantQuotes) {
      const seg = q.segmentId ? ` [${q.segmentId}]` : "";
      const why = q.reason ? ` — ${q.reason}` : "";
      lines.push(`  • «${q.quote}»${seg}${why} (${q.confidence})`);
    }
    lines.push("");
  }

  if (ev.offTopicAnswers.length > 0) {
    lines.push("**Возможные уходы от темы:**");
    for (const o of ev.offTopicAnswers) {
      const seg = o.segmentId ? ` [${o.segmentId}]` : "";
      lines.push(`  • «${o.quote}»${seg} (${o.confidence})`);
    }
    lines.push("");
  }

  lines.push(`**Качество транскрипта:** разделение спикеров — ${ev.qualitySpeaker}, шум — ${ev.qualityNoise}`);

  return lines.join("\n");
}

// ── Zod schemas for block extraction output ───────────────────────────────────

const EvidenceReferenceSchema = z.object({
  category: z.enum([
    "repeatedThemes", "repeatedPhrases", "uncertaintyMarkers",
    "possibleOffTopicAnswers", "importantQuotes", "possibleTranscriptionIssues",
  ]),
  evidenceId:   z.string().optional(),
  segmentId:    z.string().optional(),
  startSeconds: z.number().optional(),
  endSeconds:   z.number().optional(),
  quote:        z.string().max(300).optional(),
});

const AnalysisBlockSchema = z.object({
  id:             z.string().max(200),
  title:          z.string().max(500).optional(),
  content:        z.string().max(20000),
  tags:           z.array(z.string().max(100)).max(10).optional(),
  isInterpretive: z.boolean(),
  explanation:    z.string().max(1500).optional(),
  evidenceTooltip: z.array(z.string().max(600)).min(1).max(8).optional(),
  evidenceRefs:   z.array(EvidenceReferenceSchema).max(10).optional(),
  confidence:     z.enum(["high", "medium", "low"]).optional(),
});

export const BlocksOutputSchema = z.object({
  blocks: z.array(AnalysisBlockSchema).min(1).max(30),
});

export type BlocksLLMOutput = z.infer<typeof BlocksOutputSchema>;

// ── Block extraction prompt ───────────────────────────────────────────────────

export function buildBlockExtractionPrompt(
  analysisText: string,
  evidence: PreparedAnalysisEvidence,
): { systemPrompt: string; userPrompt: string } {
  const evidenceSection = evidenceToPromptSection(evidence);

  const systemPrompt =
`Ты — ассистент, который структурирует готовый аналитический текст психологической консультации.

Тебе дан:
1. Готовый аналитический текст (разбит на разделы с заголовками).
2. Компактные данные наблюдений из транскрипта.

Твоя задача — разбить текст на блоки и для ИНТЕРПРЕТАЦИОННЫХ блоков создать поле explanation.

═══════════════════════════════════════════════════════
ПРАВИЛА РАЗБИВКИ НА БЛОКИ:
═══════════════════════════════════════════════════════

- Каждый заголовок (##, ###) и его текст — отдельный блок.
- isInterpretive: true — только для гипотез, интерпретаций, паттернов, обобщений.
  Примеры: "Похоже, тема оценки...", "Можно предположить...", "Это может быть..."
- isInterpretive: false — для фактических описаний, перечислений тем, вопросов к следующей сессии.
  Примеры: "Клиент упоминает...", "В транскрипте...", "Вопросы для следующей сессии:"
- Не суммаризируй и не перефразируй content — переноси текст точно как в анализе.
- Если внутри блока есть самостоятельные строки-подзаголовки без Markdown-разметки
  (например «Фигура», «Фон», «Контакт», «Запрос клиента» на отдельной строке без ##) —
  при копировании content добавь перед ними ### : "### Фигура\nТекст..."

═══════════════════════════════════════════════════════
ПОЛЕ explanation (ГЛАВНОЕ ИЗМЕНЕНИЕ):
═══════════════════════════════════════════════════════

Для каждого блока с isInterpretive=true и РЕАЛЬНЫМИ данными наблюдений:
обязательно создай поле explanation из 2–4 содержательных предложений.

Структура explanation (три части):
1. ЧТО наблюдается: фактическое наблюдение из данных (без интерпретации).
2. ПОЧЕМУ это связано с выводом: логика связи между наблюдением и выводом.
3. ОГРАНИЧЕНИЕ: что нельзя утверждать точно, альтернативное объяснение.

КРИТЕРИИ КАЧЕСТВА:

ПЛОХО (нельзя):
  "Тема родителей поднималась 3 раза."
  "Фраза «не знаю» использована 5 раз."
  "Найдено несколько упоминаний."

ХОРОШО (нужно):
  "Клиент несколько раз возвращается к теме влияния родителей на его решения.
  Эти упоминания появляются при обсуждении выбора профессии и будущего —
  поэтому тема выглядит не случайной, а связанной с актуальной неопределённостью.
  Само количество повторов не доказывает психологическую причину, но показывает,
  что этот вопрос занимает заметное место в разговоре."

  "Фраза «не знаю» несколько раз появляется в ответах на вопросы о будущем
  и собственных желаниях. В этих фрагментах она может отражать реальную
  неопределённость, трудность сформулировать позицию или нежелание отвечать
  однозначно. По одному речевому маркеру нельзя делать уверенный вывод —
  это скорее направление для дальнейшего уточнения."

ОБЪЁМ: 40–90 слов. Не превращай лупу в отдельный анализ. Не пересказывай основной вывод.
ГОЛОС: от наблюдения, не от модели. Не "AI считает...", а "Тема встречается..."
Не ставь диагнозы. Не делай категоричных утверждений.

Если evidenceRefs нечем подкрепить реальными данными — не создавай explanation вовсе.

═══════════════════════════════════════════════════════
ПОЛЕ evidenceRefs:
═══════════════════════════════════════════════════════

- Ссылайся только на segmentId и category, которые реально есть в данных выше.
- В поле quote включай ТОЧНЫЕ цитаты из данных наблюдений (до 150 символов).
  Не придумывай цитаты. Берись только из данных, которые показаны выше.
- Не придумывай segmentId, таймкоды.
- Выбирай 1–3 самых сильных подтверждающих фрагмента, а не все подряд.

═══════════════════════════════════════════════════════
ОСТАЛЬНЫЕ ПОЛЯ:
═══════════════════════════════════════════════════════

- confidence: только для interpretive blocks, берётся из данных (не выдумывай).
- evidenceTooltip: НЕ создавай — поле устарело, explanation заменяет его.
- Возвращай ТОЛЬКО валидный JSON, без markdown и комментариев.

СТРУКТУРА JSON:
{
  "blocks": [
    {
      "id": "block-1",
      "title": "Заголовок раздела",
      "content": "Точный текст раздела с нормализованными ### подзаголовками",
      "isInterpretive": true,
      "explanation": "2–4 предложения: что наблюдается + почему важно + ограничение.",
      "evidenceRefs": [
        {"category": "repeatedThemes", "segmentId": "seg-3", "quote": "Точная цитата из данных"},
        {"category": "importantQuotes", "quote": "Другая цитата из данных"}
      ],
      "confidence": "medium",
      "tags": ["тревога"]
    },
    {
      "id": "block-2",
      "title": "Фактический раздел",
      "content": "Текст",
      "isInterpretive": false
    }
  ]
}`;

  const userPrompt =
`${evidenceSection}

---

АНАЛИТИЧЕСКИЙ ТЕКСТ:

${analysisText.slice(0, 12_000)}

---

Верни ТОЛЬКО валидный JSON с массивом blocks.`;

  return { systemPrompt, userPrompt };
}
