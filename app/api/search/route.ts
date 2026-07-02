import { NextRequest, NextResponse } from "next/server";
import { getClients } from "@/lib/data/clients";
import { getConsultations } from "@/lib/data/consultations";
import { getEntries } from "@/lib/data/notebook";

function norm(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function fmtDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

// Stem: remove last 2 chars for Russian morphology (кошка→кошк, тревога→трево)
// Minimum stem length 3. Short queries matched as-is.
function stems(q: string): string[] {
  const n = norm(q);
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.map((p) => (p.length > 4 ? p.slice(0, -2) : p));
}

function matchesQuery(text: string, queryStems: string[]): boolean {
  const t = norm(text);
  return queryStems.every((s) => t.includes(s));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ clients: [], consultations: [], notebook: [] });

  const nq = norm(q);
  const qs = stems(q);

  const [allClients, allConsultations, nbPage] = await Promise.all([
    getClients(),
    getConsultations(),
    getEntries({ page: 1, pageSize: 5, search: q, sort: "newest", group: "none", date: "all", status: "all" }),
  ]);

  const clients = allClients
    .filter((c) => norm(c.name).includes(nq) || matchesQuery(c.name, qs))
    .slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name, status: c.status as string }));

  const consultations = allConsultations
    .filter((c) => {
      const analysesText = (c.analyses ?? []).map((a) => {
        const blockText = (a.blocks ?? []).map((b) => [b.title, b.content].filter(Boolean).join(" ")).join(" ");
        return [a.result, blockText].filter(Boolean).join(" ");
      }).join(" ");
      const formattedText = (c.transcriptFormatted ?? []).map((s) => s.text).join(" ");
      const text = [c.title, c.notes, c.transcript?.text, formattedText, analysesText].filter(Boolean).join(" ");
      return matchesQuery(text, qs);
    })
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title || `Консультация от ${fmtDate(c.createdAt)}`,
      clientName: c.clientName || "",
      date: fmtDate(c.createdAt),
    }));

  const notebook = nbPage.entries.slice(0, 4).map((e) => ({
    id: e.id,
    text: (e.text || e.title || "").slice(0, 100),
    clientName: e.clientName,
    date: fmtDate(e.createdAt),
  }));

  return NextResponse.json({ clients, consultations, notebook });
}
