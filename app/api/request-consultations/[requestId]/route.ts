import { NextRequest, NextResponse } from "next/server";
import { getConsultationsByRequestId } from "@/lib/data/consultations";
import { getChatMessageCounts }        from "@/lib/data/chatMessages";

export interface ConsultationSummary {
  id:            string;
  title:         string;
  createdAt:     string;
  source:        string;
  status:        string;
  analysesCount: number;
  analysesModes: string[];
  hasNotes:      boolean;
  hasTranscript: boolean;
  chatCount:     number;
  sessionNumber: number;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;
  try {
    const consultations = await getConsultationsByRequestId(requestId);
    const chatCounts    = await getChatMessageCounts(consultations.map(c => c.id));

    const result: ConsultationSummary[] = consultations.map((c, i) => ({
      id:            c.id,
      title:         c.title,
      createdAt:     c.createdAt,
      source:        c.source,
      status:        c.status,
      analysesCount: (c.analyses ?? []).length,
      analysesModes: (c.analyses ?? []).map(a => a.mode),
      hasNotes:      !!(c.notes),
      hasTranscript: !!(c.transcript?.text ?? (c as { transcript_text?: string }).transcript_text),
      chatCount:     chatCounts[c.id] ?? 0,
      sessionNumber: i + 1,
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
