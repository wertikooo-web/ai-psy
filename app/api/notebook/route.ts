import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry, type NotebookDateFilter, type NotebookGroup, type NotebookSort } from "@/lib/data/notebook";
import { randomUUID } from "crypto";

const SORTS: NotebookSort[] = ["newest", "oldest", "updated", "client", "topic"];
const GROUPS: NotebookGroup[] = ["none", "date", "client", "topic"];
const DATES: NotebookDateFilter[] = ["all", "today", "7d", "30d", "custom"];

function splitTags(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sort = sp.get("sort") as NotebookSort | null;
    const group = sp.get("group") as NotebookGroup | null;
    const date = sp.get("date") as NotebookDateFilter | null;
    const result = await getEntries({
      page:   Math.max(1, Number(sp.get("page") ?? 1) || 1),
      search: sp.get("search")?.trim() || undefined,
      client: sp.get("client")?.trim() || undefined,
      topic:  sp.get("topic")?.trim() || undefined,
      tags:   splitTags(sp.get("tags")),
      sort:   sort && SORTS.includes(sort) ? sort : "newest",
      group:  group && GROUPS.includes(group) ? group : "none",
      date:   date && DATES.includes(date) ? date : "all",
      from:   sp.get("from") ?? undefined,
      to:     sp.get("to") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[notebook GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    const entry = await addEntry({
      id:       randomUUID(),
      title:    body.title ?? "",
      text,
      clientId: body.clientId || undefined,
      topic:    body.topic || undefined,
      tags:     Array.isArray(body.tags) ? body.tags : splitTags(body.tags ?? ""),
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[notebook POST]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
