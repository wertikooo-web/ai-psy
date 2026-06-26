import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "text обязателен" }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const completion = await openai.chat.completions.create({
      model:       "gpt-4o",
      temperature: 0.1,
      max_tokens:  4000,
      messages: [
        { role: "system",  content: system },
        { role: "user",    content: text },
      ],
    });

    const formatted = completion.choices[0]?.message?.content ?? text;
    return NextResponse.json({ formatted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
