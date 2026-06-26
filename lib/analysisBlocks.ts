/**
 * Types and utilities for structured analysis blocks (Step 2).
 *
 * AnalysisBlock wraps one semantic section of the analysis output.
 * Blocks with isInterpretive=true may carry evidenceTooltip and evidenceRefs
 * for the future 🔍 UI (Step 3).
 *
 * The `result` field on an analysis entry remains the canonical markdown text.
 * Blocks are a parallel structure for Step 3 — never shown in old UI.
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
  evidenceTooltip?: string[];   // 2–5 short strings, only for interpretive blocks
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
      quote:      t.evidence[0]?.quote?.slice(0, 80),
    })),
    repeatedPhrases: ev.repeatedPhrases.slice(0, 5).map((p) => ({
      phrase:      p.phrase,
      occurrences: p.occurrences,
      confidence:  p.confidence,
      segmentId:   p.evidence[0]?.segmentId,
    })),
    uncertaintyTotal:    ev.uncertaintyMarkers.total,
    uncertaintyExamples: ev.uncertaintyMarkers.examples.slice(0, 3).map((e) => ({
      segmentId: e.segmentId,
      quote:     e.quote.slice(0, 70),
    })),
    offTopicAnswers: ev.possibleOffTopicAnswers.slice(0, 3).map((e) => ({
      segmentId:  e.segmentId,
      quote:      e.quote.slice(0, 80),
      reason:     e.reason,
      confidence: e.confidence,
    })),
    importantQuotes: ev.importantQuotes.slice(0, 5).map((e) => ({
      segmentId:  e.segmentId,
      quote:      e.quote.slice(0, 100),
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
      lines.push(`- ${t.label}: ${t.occurrences}× — уверенность: ${t.confidence}${seg}`);
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
  quote:        z.string().max(120).optional(),
});

const AnalysisBlockSchema = z.object({
  id:             z.string().max(50),
  title:          z.string().max(200).optional(),
  content:        z.string().max(4000),
  tags:           z.array(z.string().max(50)).max(5).optional(),
  isInterpretive: z.boolean(),
  evidenceTooltip: z.array(z.string().max(300)).min(2).max(5).optional(),
  evidenceRefs:   z.array(EvidenceReferenceSchema).max(5).optional(),
  confidence:     z.enum(["high", "medium", "low"]).optional(),
});

export const BlocksOutputSchema = z.object({
  blocks: z.array(AnalysisBlockSchema).min(1).max(20),
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

Твоя задача — разбить текст на блоки и для ИНТЕРПРЕТАЦИОННЫХ блоков создать evidenceTooltip.

ПРАВИЛА:
- Каждый заголовок (##, ###) и его текст — отдельный блок.
- isInterpretive: true — только для гипотез, интерпретаций, паттернов, обобщений.
  Примеры: "Похоже, тема оценки...", "Можно предположить...", "Это может быть..."
- isInterpretive: false — для фактических описаний, перечислений тем, вопросов к следующей сессии.
  Примеры: "Клиент упоминает...", "В транскрипте...", "Вопросы для следующей сессии:"
- evidenceTooltip: 2–5 коротких строк, только для isInterpretive=true, только если есть реальные данные.
  Каждая строка отвечает на вопрос: "почему этот вывод появился в анализе?"
  Пиши от наблюдения, не от модели. Не "AI считает...", а "Тема встречается в 4 эпизодах..."
  Не ставь диагнозы. Не делай категоричных утверждений.
- Если evidenceTooltip нечем подкрепить — не создавай его вовсе.
- evidenceRefs: ссылайся только на segmentId и category, которые реально есть в данных выше.
  Не придумывай segmentId, таймкоды, цитаты.
- confidence: только для interpretive blocks, берётся из данных (не выдумывай).
- Не суммаризируй и не перефразируй content — переноси текст точно как в анализе.
- Возвращай ТОЛЬКО валидный JSON, без markdown и комментариев.

СТРУКТУРА JSON:
{
  "blocks": [
    {
      "id": "block-1",
      "title": "Заголовок раздела",
      "content": "Точный текст раздела",
      "isInterpretive": true,
      "evidenceTooltip": ["строка 1", "строка 2"],
      "evidenceRefs": [{"category": "repeatedThemes", "segmentId": "seg-3"}],
      "confidence": "medium",
      "tags": ["тревога"]
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
