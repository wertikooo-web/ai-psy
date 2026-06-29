import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getConsultation } from "@/lib/data/consultations";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { consultationId, chatHistory } = await req.json() as {
      consultationId?: string;
      chatHistory?: Array<{ role: string; content: string }>;
    };

    if (!consultationId) return NextResponse.json({ suggestions: [] });

    const consultation = await getConsultation(consultationId);
    if (!consultation) return NextResponse.json({ suggestions: [] });

    // Build context from analysis and transcript
    const analysisTexts = (consultation.analyses ?? [])
      .slice(-2)
      .map((a: { result?: string }) => a.result ?? "")
      .filter(Boolean)
      .join("\n\n");

    const transcriptSnippet = (consultation.transcript?.text ?? "").slice(0, 1500);

    const chatSnippet = (chatHistory ?? [])
      .slice(-6)
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "Психолог" : "AI"}: ${m.content}`)
      .join("\n");

    const context = [
      analysisTexts && `=== Анализ ===\n${analysisTexts}`,
      transcriptSnippet && `=== Транскрипт (фрагмент) ===\n${transcriptSnippet}`,
      chatSnippet && `=== Последние сообщения чата ===\n${chatSnippet}`,
    ].filter(Boolean).join("\n\n");

    if (!context.trim()) return NextResponse.json({ suggestions: [] });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "Ты помощник психолога. На основе контекста сессии предложи 2-3 коротких вопроса, которые психолог может задать AI-ассистенту прямо сейчас. Вопросы должны быть конкретными, по теме этой сессии. Ответь ТОЛЬКО JSON-массивом строк, без пояснений. Пример: [\"Как работать с тревогой клиента?\", \"Какую технику применить?\"]",
        },
        {
          role: "user",
          content: context,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3).map(String);
    } catch {
      // fallback: try to extract quoted strings
      const matches = raw.match(/"([^"]+)"/g);
      if (matches) suggestions = matches.slice(0, 3).map((s: string) => s.replace(/"/g, ""));
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("[chat-suggestions]", e);
    return NextResponse.json({ suggestions: [] });
  }
}
