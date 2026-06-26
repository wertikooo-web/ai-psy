import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import type { FormattedSegment, WhisperSegment } from "@/lib/consultationStore";

export const maxDuration = 120;

// ── Speaker assignment via Whisper segments (real timecodes) ──────────────────
// Send all segments to GPT; it returns {assignments:[{id,speaker}]}.
// We keep original start/end — no approximations.

async function assignSpeakersToSegments(
  openai: OpenAI,
  segments: WhisperSegment[],
): Promise<FormattedSegment[]> {
  // Truncate if segments JSON is too large (~15 k chars ≈ 3 750 tokens)
  let usedSegments = segments;
  const fullJson = JSON.stringify(segments);
  if (fullJson.length > 15_000) {
    // estimate chars-per-segment ratio to pick how many fit
    const ratio = fullJson.length / segments.length;
    usedSegments = segments.slice(0, Math.floor(15_000 / ratio));
    console.warn(`[format-transcript] truncated segments: ${segments.length} → ${usedSegments.length}`);
  }

  const segJson = JSON.stringify(
    usedSegments.map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text }))
  );

  const system = `Ты помогаешь психологу разметить транскрипт сессии по спикерам.
Получаешь JSON-массив сегментов Whisper (с реальными таймкодами start/end в секундах).
Определи, кто говорит в каждом сегменте:
- "therapist" — психолог (задаёт вопросы, направляет беседу, комментирует)
- "client" — клиент (рассказывает о себе, отвечает на вопросы)
- "unknown" — если определить невозможно

Верни ТОЛЬКО JSON-объект в формате:
{"assignments": [{"id": 0, "speaker": "therapist"}, {"id": 1, "speaker": "client"}, ...]}

Включи ВСЕ сегменты по порядку. Не меняй id.`;

  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      temperature:     0.1,
      max_tokens:      2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user",   content: segJson },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (e) {
    throw new Error(`OpenAI error: ${e instanceof Error ? e.message : String(e)}`);
  }

  let parsed: { assignments?: Array<{ id: number; speaker: string }> } = {};
  try { parsed = JSON.parse(raw); } catch { /* use empty */ }

  // Build a speaker lookup by segment id
  const speakerMap = new Map<number, FormattedSegment["speaker"]>();
  for (const a of parsed.assignments ?? []) {
    const sp = a.speaker === "therapist" ? "therapist"
             : a.speaker === "client"    ? "client"
             : "unknown";
    speakerMap.set(a.id, sp);
  }

  // Map back to FormattedSegment[], preserving real timestamps
  return usedSegments.map((s, i) => ({
    order_index:   i,
    speaker:       speakerMap.get(s.id) ?? "unknown",
    start_seconds: s.start,
    end_seconds:   s.end,
    text:          s.text,
  }));
}

// ── Speaker split via plain text (no real timecodes) ──────────────────────────
// Returns FormattedSegment[] with start_seconds = end_seconds = 0.

function parseLabeled(text: string): FormattedSegment[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const result: FormattedSegment[] = [];
  let idx = 0;
  for (const line of lines) {
    const isT = /^П\s*:/i.test(line);
    const isC = /^К\s*:/i.test(line);
    const body = line.replace(/^[ПКпк—–\-]+\s*:\s*/i, "").trim();
    if (!body) continue;
    result.push({
      order_index:   idx++,
      speaker:       isT ? "therapist" : isC ? "client" : "unknown",
      start_seconds: 0,
      end_seconds:   0,
      text:          body,
    });
  }
  return result;
}

async function splitPlainText(
  openai: OpenAI,
  plainText: string,
): Promise<FormattedSegment[]> {
  const inputText = plainText.length > 12_000
    ? plainText.slice(0, 12_000) + "\n\n[Транскрипт обрезан]"
    : plainText;

  const system = `Ты помогаешь психологу разметить транскрипт сессии.
Получаешь сырой текст из Whisper (без меток спикеров, без таймкодов).
Расставь реплики, начиная каждую с новой строки:
- Реплики психолога: "П: текст реплики"
- Реплики клиента: "К: текст реплики"
- Если неизвестно: "—: текст"
Не меняй слова. Только метки и переносы строк.`;

  let gptText = "";
  try {
    const completion = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0.1,
      max_tokens:  4000,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: inputText },
      ],
    });
    gptText = completion.choices[0]?.message?.content ?? "";
  } catch (e) {
    throw new Error(`OpenAI error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!gptText.trim()) throw new Error("Пустой ответ от GPT");

  return parseLabeled(gptText);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { consultationId } = body as { consultationId?: string };

    if (!consultationId) {
      return NextResponse.json({ error: "consultationId обязателен" }, { status: 400 });
    }

    let consultation;
    try {
      consultation = await getConsultation(consultationId);
    } catch (e) {
      console.error("[format-transcript] getConsultation error:", e);
      return NextResponse.json({ error: "Ошибка загрузки консультации" }, { status: 500 });
    }
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    const plainText   = consultation.transcript?.text ?? "";
    const whisperSegs = consultation.transcriptSegments ?? [];

    if (!plainText && whisperSegs.length === 0) {
      return NextResponse.json({ error: "Нет текста транскрипта" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ error: "OPENAI_API_KEY не задан" }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });

    let formatted: FormattedSegment[];
    let hasTimecodes: boolean;

    if (whisperSegs.length > 0) {
      // ── Best path: real timestamps from Whisper ──────────────────────────
      formatted    = await assignSpeakersToSegments(openai, whisperSegs);
      hasTimecodes = true;
    } else {
      // ── Fallback: plain text, no timestamps ──────────────────────────────
      if (!plainText) {
        return NextResponse.json({ error: "Нет текста транскрипта" }, { status: 400 });
      }
      formatted    = await splitPlainText(openai, plainText);
      hasTimecodes = false;
    }

    if (formatted.length === 0) {
      return NextResponse.json({ error: "GPT не смог разделить транскрипт на реплики" }, { status: 500 });
    }

    // Save to DB (non-blocking — response returned even if DB save fails)
    updateConsultation(consultationId, { transcriptFormatted: formatted }).catch((e) => {
      console.error("[format-transcript] DB save error:", e);
    });

    return NextResponse.json({ segments: formatted, hasTimecodes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[format-transcript] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
