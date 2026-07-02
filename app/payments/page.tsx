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

  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    return payments
      .filter((p) => {
        const d = new Date(p.consultationDate || p.paymentDate || "");
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + p.paidAmount, 0);
  }, [payments]);

  return (
    <>
    {/* ── MOBILE LAYOUT ── */}
    <div className="lg:hidden flex-1 min-h-0 overflow-y-auto" style={{ background: "#FBF8F5" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10" style={{ background: "#FBF8F5", borderBottom: "1px solid #CFC0A9", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#3D3228" }}>Платежи</span>
      </div>

      {/* Summary card */}
      <div style={{ background: "#F3EBDD", padding: "14px 16px", borderBottom: "1px solid #CFC0A9" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#A8997F", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Этот месяц</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#3D3228" }}>{money.format(thisMonthTotal)} <span style={{ fontSize: 16, fontWeight: 500 }}>MDL</span></div>
      </div>

      <div style={{ padding: "12px 16px", paddingBottom: 80 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#A8997F", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Транзакции</div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 className="animate-spin" style={{ color: "#A8997F" }} />
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#A8997F" }}>
            <WalletCards size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: "#3D3228", fontSize: 14 }}>Оплат пока нет</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payments.slice(0, 30).map((row) => (
              <div key={row.id} style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: row.clientColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {row.clientInitials || row.clientName.slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.clientName}</div>
                  <div style={{ fontSize: 12, color: "#A8997F", marginTop: 2 }}>{formatDate(row.paymentDate)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#3D3228" }}>{money.format(row.paidAmount)}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 6px",
                    background: row.paymentStatus === "paid" ? "#dcfce7" : row.paymentStatus === "pending" ? "#fef3c7" : "#f3f4f6",
                    color: row.paymentStatus === "paid" ? "#16a34a" : row.paymentStatus === "pending" ? "#d97706" : "#6B7280",
                  }}>
                    {paymentStatusLabels[row.paymentStatus]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ── DESKTOP LAYOUT ── */}
    <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto">
    <div className="min-h-full bg-[#F7F3EA] p-4 sm:p-6 text-[#2F261F]">
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
                    <th className="py-3">Действия <span className="normal-case font-normal text-[#B0A090] ml-2">/ Открыть консультацию</span></th>
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
                          <Link href={`/consultation/${row.consultationId}`} className="inline-flex items-center justify-center rounded-lg w-8 h-8 transition-colors text-[#8B735C] hover:bg-[#F0E8DC] hover:text-[#5C3D1E]" title="Открыть консультацию">
                            <ArrowRight size={16} strokeWidth={2.5} />
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
    </div>{/* end hidden lg:block */}
    </>
  );
}
