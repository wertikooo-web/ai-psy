import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation } from "@/lib/data/consultations";
import { readProfile } from "@/lib/data/userProfile";

const SYSTEM_PROMPT = `Ты — AI-ассистент для психолога. Ты помогаешь специалисту анализировать сессию, замечать паттерны, готовиться к следующей встрече.

Твой стиль:
- Профессиональный, но живой — не сухой академический текст
- Конкретный: опирайся на реальные моменты из транскрипта
- Уважительный к работе психолога — ты поддерживаешь, не критикуешь
- Краткий по умолчанию: 2-4 предложения если не просят развернуть
- На русском языке

Если транскрипт предоставлен — всегда опирайся на конкретные фразы и моменты из него.
Если спрашивают о рисках — говори осторожно, без алармизма.
Если спрашивают про следующую сессию — предлагай конкретные темы или техники.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, consultationId, transcriptText } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages обязательны" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY не задан" }, { status: 500 });
    }

    // Load transcript context
    let transcript = transcriptText ?? "";
    if (!transcript && consultationId) {
      const consultation = await getConsultation(consultationId);
      transcript = consultation?.transcript?.text ?? "";
    }

    const contextBlock = transcript
      ? `\n\n---\nТРАНСКРИПТ СЕССИИ:\n${transcript.slice(0, 12000)}\n---`
      : "\n\n(Транскрипт недоступен — отвечай на основе вопроса психолога)";

    const profile = await readProfile();
    const model = profile.aiModel ?? "gpt-4o";

    const openai = new OpenAI({ apiKey });

    const isOModel = /^o\d/.test(model);
    const completion = await openai.chat.completions.create({
      model,
      ...(isOModel ? {} : { temperature: 0.7 }),
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextBlock },
        ...messages.map((m: { role: string; content: string }) => ({
          role:    m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: 600,
    });

    const reply = completion.choices[0]?.message?.content ?? "Не удалось получить ответ.";
    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[api/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка" },
      { status: 500 },
    );
  }
}
