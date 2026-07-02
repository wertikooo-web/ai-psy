import { NextRequest, NextResponse } from "next/server";
import { getClients } from "@/lib/data/clients";
import { getConsultations } from "@/lib/data/consultations";
import { getEntries } from "@/lib/data/notebook";

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

const SEARCH_STOP_WORDS = new Set([
  "найди", "найти", "покажи", "показать", "найдите", "поищи", "поискать",
  "все", "всё", "всю", "всех", "вся", "весь",
  "про", "по", "о", "об", "обо", "что", "где", "кто", "там", "тут", "здесь",
  "есть", "было", "были", "была", "был", "нет",
  "упоминание", "упоминания", "тема", "темы", "материал", "материалы",
]);

function meaningfulTokens(q: string): string[] {
  return norm(q)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !SEARCH_STOP_WORDS.has(part));
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  for (let cut = 1; cut <= Math.min(3, token.length - 3); cut += 1) {
    variants.add(token.slice(0, -cut));
  }
  return Array.from(variants).filter((item) => item.length >= 3);
}

function queryVariants(q: string): string[] {
  const variants = meaningfulTokens(q).flatMap(tokenVariants);
  return Array.from(new Set(variants));
}

function matchesQuery(text: string, query: string): boolean {
  const t = norm(text);
  const tokens = meaningfulTokens(query);
  if (!tokens.length) return t.includes(norm(query));
  return tokens.every((token) => tokenVariants(token).some((variant) => t.includes(variant)));
}

function searchScore(text: string, query: string): number {
  const t = norm(text);
  const tokens = meaningfulTokens(query);
  if (!tokens.length) return t.includes(norm(query)) ? 1 : 0;
  let score = 0;
  for (const token of tokens) {
    if (t.includes(token)) score += 10;
    else if (tokenVariants(token).some((variant) => t.includes(variant))) score += 4;
    else return 0;
  }
  if (t.includes(norm(query))) score += 20;
  return score;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ clients: [], consultations: [], notebook: [] });

  const nq = norm(q);
  const variants = queryVariants(q);

  const [allClients, allConsultations, nbPage] = await Promise.all([
    getClients(),
    getConsultations(),
    getEntries({ page: 1, pageSize: 5, search: q, sort: "newest", group: "none", date: "all", status: "all" }),
  ]);

  const clients = allClients
    .map((c) => ({ client: c, score: searchScore([c.name, c.currentFocus].filter(Boolean).join(" "), q) }))
    .filter(({ score, client }) => score > 0 || norm(client.name).includes(nq) || variants.some((variant) => norm(client.name).includes(variant)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ client }) => ({ id: client.id, name: client.name, status: client.status as string }));

  const consultations = allConsultations
    .map((c) => {
      const analysesText = (c.analyses ?? []).map((a) => {
        const blockText = (a.blocks ?? []).map((b) => [
          b.title,
          b.content,
          b.explanation,
          b.evidenceTooltip?.join(" "),
          b.tags?.join(" "),
        ].filter(Boolean).join(" ")).join(" ");
        return [a.result, blockText].filter(Boolean).join(" ");
      }).join(" ");
      const formattedText = (c.transcriptFormatted ?? []).map((s) => s.text).join(" ");
      const text = [
        c.title,
        c.notes,
        c.transcript?.text,
        formattedText,
        analysesText,
        c.analysisEvidence ? JSON.stringify(c.analysisEvidence) : "",
        c.compressedTranscript?.text,
      ].filter(Boolean).join(" ");
      return { consultation: c, score: searchScore(text, q), text };
    })
    .filter(({ score, text }) => score > 0 || matchesQuery(text, q))
    .sort((a, b) => b.score - a.score || new Date(b.consultation.createdAt).getTime() - new Date(a.consultation.createdAt).getTime())
    .slice(0, 5)
    .map(({ consultation: c }) => ({
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
