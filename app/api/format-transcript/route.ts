import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import type { WhisperSegment, FormattedSegment } from "@/lib/consultationStore";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { consultationId } = body as { consultationId?: string };

    if (!consultationId) {
      return NextResponse.json({ error: "consultationId обязателен" }, { status: 400 });
    }

    const consultation = await getConsultation(consultationId);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    const segments: WhisperSegment[] = consultation.transcriptSegments ?? [];
    const plainText = consultation.transcript?.text ?? "";

    if (!plainText && segments.length === 0) {
      return NextResponse.json({ error: "Нет текста транскрипта" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let formatted: FormattedSegment[];

    if (segments.length > 0) {
      // ── Segment-based formatting (with real timestamps) ─────────────────────
      const segJson = JSON.stringify(
        segments.map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text }))
      );

      const system = `Ты помогаешь психологу разметить транскрипт сессии по спикерам.
Получаешь массив сегментов от Whisper (с таймкодами start/end в секундах).
Определи, кто говорит в каждом сегменте: психолог ("therapist") или клиент ("client").
Если невозможно определить — используй "unknown".
Психолог обычно задаёт вопросы, направляет беседу; клиент отвечает и рассказывает о себе.
Верни JSON-массив в том же порядке. Не меняй текст сегментов.
Формат каждого элемента:
{"order_index": N, "speaker": "therapist"|"client"|"unknown", "start_seconds": float, "end_seconds": float, "text": "..."}`;

      const completion = await openai.chat.completions.create({
        model:           "gpt-4o",
        temperature:     0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user",   content: `{"segments": ${segJson}}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsed: { segments?: FormattedSegment[] } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Ошибка разбора ответа GPT" }, { status: 500 });
      }

      formatted = (parsed.segments ?? []).map((s, i) => ({
        order_index:   i,
        speaker:       s.speaker ?? "unknown",
        start_seconds: s.start_seconds ?? segments[i]?.start ?? 0,
        end_seconds:   s.end_seconds   ?? segments[i]?.end   ?? 0,
        text:          s.text ?? segments[i]?.text ?? "",
      }));

    } else {
      // ── Fallback: plain text formatting (no timestamps) ─────────────────────
      const system = `Ты помогаешь психологу разметить транскрипт сессии.
Получаешь сырой текст из Whisper (без меток спикеров и без таймкодов).
Разбей текст на реплики и определи спикера.
Верни JSON-массив. Формат каждого элемента:
{"order_index": N, "speaker": "therapist"|"client"|"unknown", "start_seconds": 0, "end_seconds": 0, "text": "..."}
Таймкоды ставь в 0 (они неизвестны). Не меняй слова.`;

      const completion = await openai.chat.completions.create({
        model:           "gpt-4o",
        temperature:     0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user",   content: `{"text": ${JSON.stringify(plainText)}}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsed: { segments?: FormattedSegment[] } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Ошибка разбора ответа GPT" }, { status: 500 });
      }

      formatted = (parsed.segments ?? []).map((s, i) => ({
        order_index:   i,
        speaker:       s.speaker ?? "unknown",
        start_seconds: 0,
        end_seconds:   0,
        text:          s.text ?? "",
      }));
    }

    // Save to DB
    await updateConsultation(consultationId, { transcriptFormatted: formatted });

    return NextResponse.json({ segments: formatted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
