"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface PaymentRow {
  id: string;
  clientId?: string;
  consultationId: string;
  chargedAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  comment?: string;
}

export interface PaymentConsultationOption {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  createdAt?: string;
}

export function derivePaymentStatus(amountDue: number | null | undefined, amountPaid: number | null | undefined): PaymentStatus {
  const due = Number(amountDue ?? 0);
  const paid = Number(amountPaid ?? 0);
  if (paid <= 0) return "unpaid";
  if (due <= 0) return "paid";
  if (paid < due) return "partial";
  return "paid";
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Не оплачено",
  partial: "Частичная оплата",
  paid: "Оплачено",
};

export const paymentStatusStyles: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-50 text-rose-600 border-rose-100",
  partial: "bg-amber-50 text-amber-700 border-amber-100",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function PaymentDialog({
  open,
  onClose,
  consultations,
  initial,
  fixedConsultationId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  consultations: PaymentConsultationOption[];
  initial?: PaymentRow | null;
  fixedConsultationId?: string;
  onSaved?: (payment: PaymentRow) => void;
}) {
  const defaultConsultationId = fixedConsultationId || consultations[0]?.id || "";
  const [consultationId, setConsultationId] = useState(defaultConsultationId);
  const [chargedAmount, setChargedAmount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedConsultation = useMemo(
    () => consultations.find((item) => item.id === consultationId),
    [consultations, consultationId],
  );

  useEffect(() => {
    if (!open) return;
    const nextConsultationId = fixedConsultationId || initial?.consultationId || consultations[0]?.id || "";
    setConsultationId(nextConsultationId);
    setChargedAmount(String(initial?.chargedAmount ?? 0));
    setPaidAmount(String(initial?.paidAmount ?? 0));
    setPaymentDate(initial?.paymentDate ?? new Date().toISOString().slice(0, 10));
    setComment(initial?.comment ?? "");
    setError("");
  }, [open, initial, fixedConsultationId, consultations]);

  if (!open) return null;

  const derivedStatus = derivePaymentStatus(Number(chargedAmount || 0), Number(paidAmount || 0));

  async function save() {
    if (!consultationId) {
      setError("Выберите консультацию");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          clientId: selectedConsultation?.clientId,
          chargedAmount: Number(chargedAmount || 0),
          paidAmount: Number(paidAmount || 0),
          paymentDate,
          comment,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Не удалось сохранить оплату");
      onSaved?.(payload as PaymentRow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить оплату");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[#D8CFBE] bg-[#FAF8F2] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#2F261F]">Оплата консультации</h2>
            <p className="mt-1 text-sm text-[#8A7A66]">Сумма сохранится и попадёт в аналитику.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#8A7A66] hover:bg-[#EFE7DA]" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Консультация</span>
            <select
              value={consultationId}
              onChange={(e) => setConsultationId(e.target.value)}
              disabled={Boolean(fixedConsultationId)}
              className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm outline-none disabled:bg-[#F0EBE1]"
            >
              {consultations.map((item) => (
                <option key={item.id} value={item.id}>
                  {(item.clientName ? `${item.clientName} · ` : "") + (item.title || "Консультация")}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Начислено</span>
              <input value={chargedAmount} onChange={(e) => setChargedAmount(e.target.value)} type="number" min="0" step="0.01" className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm outline-none" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Получено</span>
              <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} type="number" min="0" step="0.01" className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm outline-none" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Статус</span>
              <div className={`flex h-11 items-center rounded-xl border px-3 text-sm font-semibold ${paymentStatusStyles[derivedStatus]}`}>
                {paymentStatusLabels[derivedStatus]}
              </div>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Дата оплаты</span>
              <input value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} type="date" className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm outline-none" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8A7A66]">Комментарий</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-xl border border-[#D8CFBE] bg-white px-3 py-2 text-sm outline-none" placeholder="Перевод, наличные, частичная оплата..." />
          </label>

          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-[#D8CFBE] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D4F] hover:bg-[#F7F3EA]">Отмена</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#8B735C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#735D49] disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
