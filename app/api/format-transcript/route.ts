import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import type { FormattedSegment, WhisperSegment } from "@/lib/consultationStore";

export const maxDuration = 120;

/**
 * Parse "П: ...\nК: ..." formatted text into FormattedSegment[].
 * Optionally maps segments to Whisper timestamps by best-effort text matching.
 */
function parseTextToSegments(
  formatted: string,
  whisperSegments?: WhisperSegment[],
): FormattedSegment[] {
  const lines = formatted.split("\n").filter((l) => l.trim().length > 0);
  const result: FormattedSegment[] = [];

  let idx = 0;
  for (const line of lines) {
    const therapist = /^П\s*:/i.test(line);
    const client    = /^К\s*:/i.test(line);
    const text = line.replace(/^[ПКпк—–\-]+\s*:\s*/i, "").trim();
    if (!text) continue;

    const speaker: FormattedSegment["speaker"] = therapist ? "therapist" : client ? "client" : "unknown";

    // Best-effort timestamp: find a Whisper segment whose text overlaps this line
    let start_seconds = 0;
    let end_seconds   = 0;
    if (whisperSegments?.length) {
      const searchText = text.slice(0, 30).toLowerCase();
      const match = whisperSegments.find((s) =>
        s.text.toLowerCase().includes(searchText.slice(0, 20))
      );
      if (match) {
        start_seconds = match.start;
        end_seconds   = match.end;
      }
    }

    result.push({ order_index: idx++, speaker, start_seconds, end_seconds, text });
  }

  return result;
}

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

    const plainText      = consultation.transcript?.text ?? "";
    const whisperSegs    = consultation.transcriptSegments;

    if (!plainText) {
      return NextResponse.json({ error: "Нет текста транскрипта" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ error: "OPENAI_API_KEY не задан" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    // Limit input to avoid timeouts on very long transcripts
    const inputText = plainText.length > 12_000
      ? plainText.slice(0, 12_000) + "\n\n[Транскрипт обрезан для обработки]"
      : plainText;

    const system = `Ты помогаешь психологу разметить транскрипт сессии.
Получаешь сырой текст из Whisper (без меток спикеров).
Задача: расставить реплики, начиная каждую с новой строки:
- Реплики психолога: "П: текст реплики"
- Реплики клиента: "К: текст реплики"

Правила:
- Определяй смену спикера по смыслу, вопросам/ответам, контексту
- Не меняй слова — только добавляй метки и переносы строк
- Не добавляй комментарии, только форматированный текст
- Если не можешь определить кто говорит — используй "—: текст"`;

    let gptResponse: string;
    try {
      const completion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",  // faster → avoids Railway 60s timeout
        temperature: 0.1,
        max_tokens:  4000,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: inputText },
        ],
      });
      gptResponse = completion.choices[0]?.message?.content ?? "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[format-transcript] OpenAI error:", msg);
      return NextResponse.json({ error: `Ошибка OpenAI: ${msg}` }, { status: 500 });
    }

    if (!gptResponse.trim()) {
      return NextResponse.json({ error: "Пустой ответ от GPT" }, { status: 500 });
    }

    // Convert П:/К: text → FormattedSegment[]
    const segments = parseTextToSegments(gptResponse, whisperSegs);

    if (segments.length === 0) {
      return NextResponse.json({ error: "GPT не смог разделить текст на реплики" }, { status: 500 });
    }

    // Save to DB (non-blocking — don't fail the response if DB update fails)
    updateConsultation(consultationId, { transcriptFormatted: segments }).catch((e) => {
      console.error("[format-transcript] save error:", e);
    });

    return NextResponse.json({ segments, formatted: gptResponse });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[format-transcript] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
