import { NextResponse } from "next/server";
import { getConsultations } from "@/lib/data/consultations";
import { getClients } from "@/lib/data/clients";
import { getPayments, upsertPayment, type PaymentInput } from "@/lib/data/payments";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const consultationId = url.searchParams.get("consultationId");
    const clientId = url.searchParams.get("clientId");
    const status = url.searchParams.get("status");
    const [payments, consultations, clients] = await Promise.all([
      getPayments(),
      getConsultations(),
      getClients(),
    ]);
    const consultationMap = new Map(consultations.map((item) => [item.id, item]));
    const clientMap = new Map(clients.map((item) => [item.id, item]));
    const rows = payments
      .filter((item) => !consultationId || item.consultationId === consultationId)
      .filter((item) => !clientId || item.clientId === clientId)
      .filter((item) => !status || status === "all" || item.paymentStatus === status)
      .map((item) => {
        const consultation = consultationMap.get(item.consultationId);
        const client = item.clientId ? clientMap.get(item.clientId) : undefined;
        return {
          ...item,
          consultationTitle: consultation?.title || "Консультация",
          consultationDate: consultation?.createdAt ?? item.createdAt,
          clientName: client?.name ?? consultation?.clientName ?? "Без клиента",
          clientInitials: client?.initials ?? consultation?.clientInitials ?? "",
          clientColor: client?.color ?? consultation?.clientColor ?? "#8B735C",
        };
      });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[payments GET]", err);
    return NextResponse.json({ error: "Не удалось загрузить оплаты" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.consultationId) {
      return NextResponse.json({ error: "consultationId is required" }, { status: 400 });
    }
    const input: PaymentInput = {
      clientId: typeof body.clientId === "string" ? body.clientId : undefined,
      consultationId: String(body.consultationId),
      chargedAmount: Number(body.chargedAmount || 0),
      paidAmount: Number(body.paidAmount || 0),
      paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : undefined,
      comment: typeof body.comment === "string" ? body.comment : undefined,
    };
    const saved = await upsertPayment(input);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("[payments POST]", err);
    const message = err instanceof Error && err.message.includes("consultation_payments")
      ? "В Supabase не добавлена таблица consultation_payments"
      : "Не удалось сохранить оплату";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
