"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, RefreshCw, Search, WalletCards } from "lucide-react";
import {
  PaymentDialog,
  paymentStatusLabels,
  paymentStatusStyles,
  type PaymentConsultationOption,
  type PaymentRow,
  type PaymentStatus,
} from "@/components/payments/PaymentDialog";

type EnrichedPayment = PaymentRow & {
  consultationTitle: string;
  consultationDate: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
};

type StoredConsultation = {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  createdAt?: string;
};

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<EnrichedPayment[]>([]);
  const [consultations, setConsultations] = useState<PaymentConsultationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [paymentsRes, consultationsRes] = await Promise.all([
        fetch("/api/payments", { cache: "no-store" }),
        fetch("/api/consultations", { cache: "no-store" }),
      ]);
      const paymentRows = paymentsRes.ok ? await paymentsRes.json() : [];
      const consultationRows = consultationsRes.ok ? await consultationsRes.json() : [];
      setPayments(paymentRows);
      setConsultations((consultationRows as StoredConsultation[]).map((item) => ({
        id: item.id,
        title: item.title || "Консультация",
        clientId: item.clientId,
        clientName: item.clientName,
        createdAt: item.createdAt,
      })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((item) => status === "all" || item.paymentStatus === status)
      .filter((item) => !q || [item.clientName, item.consultationTitle, item.comment].some((value) => value?.toLowerCase().includes(q)));
  }, [payments, search, status]);

  const totals = useMemo(() => ({
    charged: filtered.reduce((sum, item) => sum + item.chargedAmount, 0),
    paid: filtered.reduce((sum, item) => sum + item.paidAmount, 0),
    debt: filtered.reduce((sum, item) => sum + Math.max(0, item.chargedAmount - item.paidAmount), 0),
  }), [filtered]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: PaymentRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  function onSaved() {
    load();
  }

  return (
    <div className="min-h-full bg-[#F7F3EA] p-6 text-[#2F261F]">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D8CFBE] bg-[#EFE7DA] text-[#6B5D4F]">
              <WalletCards size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold">Оплаты</h1>
              <p className="text-sm text-[#8A7A66]">Журнал оплат по консультациям, долги и частичные платежи.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-[#D8CFBE] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#FBF8F5]">
              <RefreshCw size={15} /> Обновить
            </button>
            <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-[#7A6048] px-4 py-2 text-sm font-semibold text-white hover:bg-[#634B38]">
              <Plus size={15} /> Добавить оплату
            </button>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#E6DDD0] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#8A7A66]">Начислено</p>
            <p className="mt-1 text-2xl font-bold">{money.format(totals.charged)} MDL</p>
          </div>
          <div className="rounded-xl border border-[#E6DDD0] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#8A7A66]">Получено</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{money.format(totals.paid)} MDL</p>
          </div>
          <div className="rounded-xl border border-[#E6DDD0] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#8A7A66]">Долг</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{money.format(totals.debt)} MDL</p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#D8CFBE] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-[#D8CFBE] px-3 py-2 text-sm">
              <Search size={15} className="text-[#9A8A72]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по клиенту, консультации, комментарию" className="w-full bg-transparent outline-none" />
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "all" | PaymentStatus)} className="h-10 rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm outline-none">
              <option value="all">Все статусы</option>
              {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin text-[#8B735C]" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-[#8A7A66]">
              <WalletCards size={32} className="mb-3 opacity-50" />
              <p className="font-semibold">Оплат пока нет</p>
              <p className="text-sm">Добавьте оплату из консультации или через кнопку выше.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-[#8A7A66]">
                  <tr className="border-b border-[#E6DDD0]">
                    <th className="py-3 pr-3">Клиент</th>
                    <th className="py-3 pr-3">Консультация</th>
                    <th className="py-3 pr-3">Начислено</th>
                    <th className="py-3 pr-3">Получено</th>
                    <th className="py-3 pr-3">Статус</th>
                    <th className="py-3 pr-3">Дата оплаты</th>
                    <th className="py-3">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-[#F0E8DC] hover:bg-[#FBF8F5]">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white" style={{ background: row.clientColor }}>{row.clientInitials || row.clientName.slice(0, 2)}</span>
                          {row.clientName}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{row.consultationTitle}</div>
                        <div className="text-xs text-[#8A7A66]">{formatDate(row.consultationDate)}</div>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{money.format(row.chargedAmount)} MDL</td>
                      <td className="py-3 pr-3 font-semibold">{money.format(row.paidAmount)} MDL</td>
                      <td className="py-3 pr-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${paymentStatusStyles[row.paymentStatus]}`}>{paymentStatusLabels[row.paymentStatus]}</span></td>
                      <td className="py-3 pr-3">{formatDate(row.paymentDate)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(row)} className="rounded-lg border border-[#D8CFBE] px-3 py-1.5 text-xs font-semibold text-[#6B5D4F] hover:bg-[#F7F3EA]">Изменить</button>
                          <Link href={`/consultation/${row.consultationId}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#6B4E2E] hover:bg-[#F7F3EA]">
                            Открыть <ArrowRight size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <PaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        consultations={consultations}
        initial={editing}
        onSaved={onSaved}
      />
    </div>
  );
}
