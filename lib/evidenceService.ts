/**
 * evidenceService — builds AnalysisEvidence from existing transcript text.
 *
 * Source priority: transcript_formatted (with speaker labels + timestamps) → transcript_text.
 * Never touches audio, FFmpeg, Whisper, or re-transcription.
 *
 * Hybrid approach:
 *   - Uncertainty markers:      counted programmatically (exact matches)
 *   - Exact phrase repetitions: detected programmatically
 *   - Themes / quotes / off-topic / transcription issues: extracted by LLM
 */

import { createHash } from "crypto";
import { z } from "zod";
import { getProvider } from "@/lib/llm";
import type {
  AnalysisEvidence,
  EvidenceItem,
  ThemeEvidence,
  PhraseEvidence,
  MarkerEvidence,
  FormattedSegment,
} from "@/lib/consultationStore";

// ── sourceHash ────────────────────────────────────────────────────────────────

/** sha256[0..16] of raw transcript text. Stale if text changes. */
export function transcriptHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

// ── Safe empty evidence (returned on any hard failure) ────────────────────────

function emptyEvidence(
  consultationId: string,
  sourceHash: string,
  transcriptUpdatedAt?: string,
): AnalysisEvidence {
  return {
    version:     "1.0",
    generatedAt: new Date().toISOString(),
    source: {
      consultationId,
      transcriptUpdatedAt,
      sourceHash,
      hasSpeakerLabels: false,
      hasTimestamps:    false,
    },
    quality: {
      speakerSeparation:  "unknown",
      transcriptionNoise: "unknown",
      notes:              ["evidence extraction failed — safe empty structure returned"],
    },
    repeatedThemes:          [],
    repeatedPhrases:         [],
    uncertaintyMarkers:      { total: 0, examples: [] },
    possibleOffTopicAnswers: [],
    importantQuotes:         [],
    possibleTranscriptionIssues: [],
  };
}

// ── Programmatic counts ───────────────────────────────────────────────────────

/** Known uncertainty phrases in Russian */
const UNCERTAINTY_PHRASES = [
  "не знаю", "наверное", "наверно", "может быть", "может быть,",
  "вроде", "вроде бы", "как-то", "как бы", "сложно сказать",
  "не уверен", "не уверена", "наверное", "возможно", "не совсем понимаю",
  "затрудняюсь", "не могу сказать", "не очень понимаю",
];

function countUncertaintyMarkers(
  text: string,
  segments: FormattedSegment[],
): MarkerEvidence {
  const lower = text.toLowerCase();
  let total = 0;
  const examplesMap = new Map<string, EvidenceItem>();

  for (const phrase of UNCERTAINTY_PHRASES) {
    let idx = 0;
    while ((idx = lower.indexOf(phrase, idx)) !== -1) {
      total++;
      if (examplesMap.size < 5 && !examplesMap.has(phrase)) {
        // Find the segment this belongs to
        const seg = segments.find(
          (s) => s.speaker === "client" &&
                 s.text.toLowerCase().includes(phrase),
        );
        const rawIdx = text.toLowerCase().indexOf(phrase);
        const snippet = text.slice(Math.max(0, rawIdx - 15), rawIdx + phrase.length + 30).trim();
        examplesMap.set(phrase, {
          segmentId:   seg ? String(seg.order_index) : undefined,
          quote:       snippet.slice(0, 100),
          speaker:     seg ? (seg.speaker === "client" ? "client" : "psychologist") : "unknown",
          startSeconds: seg?.start_seconds,
          endSeconds:   seg?.end_seconds,
          confidence:  "high",
          reason:      `маркер неопределённости "${phrase}"`,
        });
      }
      idx += phrase.length;
    }
  }

  return { total, examples: Array.from(examplesMap.values()) };
}

// ── Segment → readable dialogue for LLM ──────────────────────────────────────

interface IndexedLine {
  idx:     string;  // "seg-{order_index}" or "line-{n}"
  speaker: "client" | "psychologist" | "unknown";
  start?:  number;
  end?:    number;
  text:    string;
}

function buildIndexedLines(
  segments: FormattedSegment[],
  rawText: string,
): { lines: IndexedLine[]; hasSpeakers: boolean; hasTimestamps: boolean } {
  if (segments.length > 0) {
    const lines: IndexedLine[] = segments.map((s) => ({
      idx:     `seg-${s.order_index}`,
      speaker: s.speaker === "client" ? "client" :
               s.speaker === "therapist" ? "psychologist" : "unknown",
      start:   s.start_seconds || undefined,
      end:     s.end_seconds   || undefined,
      text:    s.text,
    }));
    const hasTimestamps = lines.some((l) => l.start != null);
    return { lines, hasSpeakers: true, hasTimestamps };
  }

  // Fallback: split raw text into numbered lines
  const rawLines = rawText.split(/\n+/).filter((l) => l.trim());
  const lines: IndexedLine[] = rawLines.map((text, i) => ({
    idx:     `line-${i}`,
    speaker: "unknown",
    text,
  }));
  return { lines, hasSpeakers: false, hasTimestamps: false };
}

function linesToPromptText(lines: IndexedLine[]): string {
  return lines
    .map((l) => {
      const who  = l.speaker === "client" ? "Клиент" :
                   l.speaker === "psychologist" ? "Психолог" : "?";
      const time = l.start != null ? ` [${Math.floor(l.start / 60)}:${String(Math.floor(l.start % 60)).padStart(2,"0")}]` : "";
      return `[${l.idx}]${time} ${who}: ${l.text}`;
    })
    .join("\n");
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const EvidenceItemSchema = z.object({
  segmentId:    z.string().optional(),
  quote:        z.string().max(200),
  speaker:      z.enum(["client", "psychologist", "unknown"]),
  startSeconds: z.number().optional(),
  endSeconds:   z.number().optional(),
  confidence:   z.enum(["high", "medium", "low"]),
  reason:       z.string().max(300).optional(),
});

const ThemeEvidenceSchema = z.object({
  label:       z.string().max(100),
  occurrences: z.number().int().min(1),
  evidence:    z.array(EvidenceItemSchema).max(5),
  confidence:  z.enum(["high", "medium", "low"]),
});

const PhraseEvidenceSchema = z.object({
  phrase:      z.string().max(100),
  occurrences: z.number().int().min(1),
  evidence:    z.array(EvidenceItemSchema).max(5),
  confidence:  z.enum(["high", "medium", "low"]),
});

const LLMOutputSchema = z.object({
  repeatedThemes:          z.array(ThemeEvidenceSchema).max(7),
  repeatedPhrases:         z.array(PhraseEvidenceSchema).max(7),
  possibleOffTopicAnswers: z.array(EvidenceItemSchema).max(7),
  importantQuotes:         z.array(EvidenceItemSchema).max(7),
  possibleTranscriptionIssues: z.array(EvidenceItemSchema).max(7),
  qualitySpeakerSeparation:    z.enum(["good", "partial", "poor", "unknown"]),
  qualityTranscriptionNoise:   z.enum(["low", "medium", "high", "unknown"]),
  qualityNotes:                z.array(z.string().max(200)).max(5),
});

type LLMOutput = z.infer<typeof LLMOutputSchema>;

// ── LLM prompt ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — ассистент психолога. Тебе дан транскрипт консультации с метками строк [seg-N] или [line-N].
Твоя задача — извлечь структурированные наблюдения для скрытой карты доказательств.

ПРАВИЛА:
- Возвращай ТОЛЬКО валидный JSON, без комментариев и markdown.
- Не ставь диагнозы и не приписывай мотивы как факты.
- Не исправляй речь клиента.
- Не пересказывай транскрипт.
- Цитата (quote) — короткий фрагмент из текста, до 120 символов, точная или очень близкая к тексту.
- segmentId — id строки из транскрипта (например "seg-3" или "line-7").
- speaker: "client" для клиента, "psychologist" для психолога, "unknown" если неизвестно.
- confidence: "high" если 3+ независимых фрагмента; "medium" если 2 или один выраженный; "low" если 1 неоднозначный.
- Не используй "high" если тема встретилась только один раз.
- Для possibleTranscriptionIssues: фиксируй бессвязные слова, явные сбои, путаницу говорящих.
- Для possibleOffTopicAnswers: только явные случаи, когда вопрос психолога конкретный, а ответ уходит в сторону.
- Если данных нет — возвращай пустой массив [].

СТРУКТУРА JSON:
{
  "repeatedThemes": [
    { "label": "название темы", "occurrences": 2, "confidence": "medium",
      "evidence": [{"segmentId":"seg-N","quote":"...","speaker":"client","startSeconds":null,"confidence":"medium","reason":"..."}] }
  ],
  "repeatedPhrases": [
    { "phrase": "фраза", "occurrences": 3, "confidence": "high",
      "evidence": [{"segmentId":"seg-N","quote":"...","speaker":"client","startSeconds":null,"confidence":"high"}] }
  ],
  "possibleOffTopicAnswers": [
    {"segmentId":"seg-N","quote":"...","speaker":"client","startSeconds":null,"confidence":"low","reason":"..."}
  ],
  "importantQuotes": [
    {"segmentId":"seg-N","quote":"...","speaker":"client","startSeconds":null,"confidence":"high","reason":"..."}
  ],
  "possibleTranscriptionIssues": [
    {"segmentId":"seg-N","quote":"...","speaker":"unknown","startSeconds":null,"confidence":"medium","reason":"..."}
  ],
  "qualitySpeakerSeparation": "good",
  "qualityTranscriptionNoise": "low",
  "qualityNotes": []
}`;

// ── Main service ──────────────────────────────────────────────────────────────

export interface BuildEvidenceInput {
  consultationId:      string;
  transcriptText:      string;
  transcriptFormatted?: FormattedSegment[];
  transcriptUpdatedAt?: string;
  model?:              string;
}

export async function buildEvidence(
  input: BuildEvidenceInput,
): Promise<AnalysisEvidence> {
  const {
    consultationId,
    transcriptText,
    transcriptFormatted = [],
    transcriptUpdatedAt,
    model = "gpt-4o",
  } = input;

  const startTime = Date.now();
  const hash = transcriptHash(transcriptText);

  const { lines, hasSpeakers, hasTimestamps } =
    buildIndexedLines(transcriptFormatted, transcriptText);

  // Programmatic: count uncertainty markers from client lines only
  const clientText = hasSpeakers
    ? transcriptFormatted
        .filter((s) => s.speaker === "client")
        .map((s) => s.text)
        .join(" ")
    : transcriptText;

  const uncertaintyMarkers = countUncertaintyMarkers(
    clientText,
    transcriptFormatted,
  );

  // Build prompt text — limit to 28k chars to stay within token budget
  const dialogueText = linesToPromptText(lines);
  const trimmedDialogue =
    dialogueText.length > 28_000
      ? dialogueText.slice(0, 28_000) + "\n[...транскрипт обрезан...]"
      : dialogueText;

  // LLM call via existing provider
  let llmOutput: LLMOutput;
  try {
    const provider = getProvider("openai");
    const result = await provider.generateText({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:   `ТРАНСКРИПТ (метки строк для segmentId):\n\n${trimmedDialogue}\n\nВерни ТОЛЬКО валидный JSON.`,
      model,
      temperature:  0.1,
      maxTokens:    3000,
    });

    // Strip possible markdown code fences
    const rawJson = result.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.error(`[evidence] consultationId=${consultationId} JSON parse failed, len=${rawJson.length}`);
      return emptyEvidence(consultationId, hash, transcriptUpdatedAt);
    }

    const validated = LLMOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error(`[evidence] consultationId=${consultationId} Zod validation failed: ${validated.error.issues.length} issues`);
      return emptyEvidence(consultationId, hash, transcriptUpdatedAt);
    }
    llmOutput = validated.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[evidence] consultationId=${consultationId} LLM call failed: ${msg}`);
    return emptyEvidence(consultationId, hash, transcriptUpdatedAt);
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[evidence] consultationId=${consultationId} ` +
    `transcriptLen=${transcriptText.length} ` +
    `hasSpeakers=${hasSpeakers} hasTimestamps=${hasTimestamps} ` +
    `elapsedMs=${elapsed} ok=true`,
  );

  return {
    version:     "1.0",
    generatedAt: new Date().toISOString(),
    source: {
      consultationId,
      transcriptUpdatedAt,
      sourceHash:       hash,
      hasSpeakerLabels: hasSpeakers,
      hasTimestamps,
    },
    quality: {
      speakerSeparation:  llmOutput.qualitySpeakerSeparation,
      transcriptionNoise: llmOutput.qualityTranscriptionNoise,
      notes:              llmOutput.qualityNotes,
    },
    repeatedThemes:          llmOutput.repeatedThemes,
    repeatedPhrases:         llmOutput.repeatedPhrases,
    uncertaintyMarkers,
    possibleOffTopicAnswers: llmOutput.possibleOffTopicAnswers,
    importantQuotes:         llmOutput.importantQuotes,
    possibleTranscriptionIssues: llmOutput.possibleTranscriptionIssues,
  };
}
