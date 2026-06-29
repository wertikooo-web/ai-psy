import { NextRequest, NextResponse } from "next/server";
import { getConsultationsByRequestId } from "@/lib/data/consultations";
import { getChatMessageCounts }        from "@/lib/data/chatMessages";
import { getClientRequestById }        from "@/lib/data/clientRequests";

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
  console.log(`[request-consultations] GET requestId=${requestId}`);
  try {
    // Look up clientId so we can also include unlinked legacy consultations
    const requestRecord = await getClientRequestById(requestId).catch(() => null);
    const consultations = await getConsultationsByRequestId(requestId, requestRecord?.clientId);
    console.log(`[request-consultations] found=${consultations.length} for requestId=${requestId}`);

    const ids       = consultations.map(c => c.id);
    const chatCounts = ids.length > 0 ? await getChatMessageCounts(ids) : {};

    const result: ConsultationSummary[] = consultations.map((c, i) => ({
      id:            c.id,
      title:         c.title,
      createdAt:     c.createdAt,
      source:        c.source,
      status:        c.status,
      analysesCount: (c.analyses ?? []).length,
      analysesModes: (c.analyses ?? []).map(a => a.mode),
      hasNotes:      !!(c.notes),
      hasTranscript: !!(c.transcript?.text),
      chatCount:     chatCounts[c.id] ?? 0,
      sessionNumber: i + 1,
    }));

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[request-consultations] error requestId=${requestId}: ${msg}`);
    // Return empty array so UI shows the empty state, not an error banner
    return NextResponse.json([]);
  }
}
