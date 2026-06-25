import { NextRequest, NextResponse } from "next/server";
import { getNotebookEntries, addNotebookEntry } from "@/lib/notebookStore";
import { randomUUID } from "crypto";

export async function GET() {
  return NextResponse.json(getNotebookEntries());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const entry = { id: randomUUID(), text, createdAt: new Date().toISOString() };
  addNotebookEntry(entry);
  return NextResponse.json(entry, { status: 201 });
}
