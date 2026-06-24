import { NextRequest, NextResponse } from "next/server";
import { getClients, createClient } from "@/lib/data/clients";

const COLORS = [
  "#6088ff", "#4f8e4f", "#e06060", "#c47d2e",
  "#9b59b6", "#2980b9", "#16a085", "#d35400",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function GET() {
  try {
    const clients = await getClients();
    return NextResponse.json(clients);
  } catch (err) {
    console.error("[clients GET]", err);
    return NextResponse.json({ error: "Ошибка получения клиентов" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = (body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });

    const allClients = await getClients();
    const color = COLORS[allClients.length % COLORS.length];

    const client = await createClient({
      name,
      initials: initials(name),
      color,
      age:     body.age ? Number(body.age) : undefined,
      concern: (body.concern ?? "").trim(),
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("[clients POST]", err);
    return NextResponse.json({ error: "Ошибка создания клиента" }, { status: 500 });
  }
}
