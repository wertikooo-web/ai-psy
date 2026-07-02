"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trash2, CheckCircle2, CircleDashed, WalletCards } from "lucide-react";
import Link from "next/link";
import type { StoredConsultation } from "@/lib/consultationStore";
import { PaymentDialog, paymentStatusLabels, type PaymentRow, type PaymentStatus } from "@/components/payments/PaymentDialog";

// ── Craft palette ─────────────────────────────────────────────────────────────
const S = {
  bg:      "#FBF8F2",
  border:  "#D8CFBE",
  header:  "#E9DCC7",
  divider: "#EDE8DE",
  num:     "#E9DCC7",
  numBdr:  "#D0C8B8",
  numTxt:  "#7A6E63",
  title:   "#6B5D4F",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getPaymentStatus(row?: PaymentRow): PaymentStatus | null {
  const status = row?.paymentStatus;
  if (status === "unpaid" || status === "partial" || status === "paid") return status;
  return null;
}

interface MockSession {
  id:            string;
  sessionNumber: number;
  topic:         string;
  date:          string;
  duration?:     string;
  status:        string;
  compareData?:  {
    prevSession: number;
    newTopics:   string[];
    strengthened: string[];
    weakened:    string[];
    requestChange: string;
  };
}

const sessionStatus: Record<string, { label: string; cls: string }> = {
  done:          { label: "Проанализирована",      cls: "bg-brand-50 text-brand-500" },
  analyzed:      { label: "Проанализирована",      cls: "bg-brand-50 text-brand-500" },
  ready:         { label: "Готово к анализу",      cls: "bg-emerald-50 text-emerald-600" },
  transcribing:  { label: "Транскрипция...",        cls: "bg-stone-100 text-stone-500" },
  analyzing:     { label: "Анализ...",              cls: "bg-stone-100 text-stone-500" },
  created:       { label: "Ожидает транскрипции",  cls: "bg-amber-50 text-amber-600" },
  uploaded:      { label: "Ожидает транскрипции",  cls: "bg-amber-50 text-amber-600" },
  new:           { label: "Ожидает анализа",       cls: "bg-amber-50 text-amber-600" },
  error:         { label: "Ошибка",                cls: "bg-red-50 text-red-500" },
};

interface Props {
  isMock:           boolean;
  mockSessions?:    MockSession[];
  realSessions?:    StoredConsultation[];
  onUpload:         () => void;
  uploadBtnLabel?:  string;
  onDeleteSession?: (id: string) => void;
  requestsMap?:     Record<string, string>;
}

export function ConsultationsTab({
  isMock,
  mockSessions  = [],
  realSessions  = [],
  onUpload,
  uploadBtnLabel = "Загрузить запись",
  onDeleteSession,
  requestsMap   = {},
}: Props) {
  const [openCompare, setOpenCompare] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [paymentFor, setPaymentFor]   = useState<StoredConsultation | null>(null);
  const [payments, setPayments]       = useState<Record<string, PaymentRow>>({});

  useEffect(() => {
    if (!realSessions.length) return;
    fetch("/api/payments")
      .then((res) => res.ok ? res.json() : [])
      .then((rows: PaymentRow[]) => {
        const map: Record<string, PaymentRow> = {};
        for (const row of rows) map[row.consultationId] = row;
        setPayments(map);
      })
      .catch(() => {});
  }, [realSessions.length]);

  const paymentConsultations = useMemo(() => realSessions.map((session) => ({
    id: session.id,
    title: session.title || "Консультация",
    clientId: session.clientId,
    clientName: session.clientName,
    createdAt: session.createdAt,
  })), [realSessions]);

  async function handleDelete(id: string) {
    if (!confirm("Удалить эту запись консультации?")) return;
    setDeletingId(id);
    await onDeleteSession?.(id);
    setDeletingId(null);
  }

  if (isMock) {
    if (mockSessions.length === 0) return <Empty onUpload={onUpload} label={uploadBtnLabel} />;
    return (
      <div className="space-y-3">
        {mockSessions.map((c, idx) => {
          const st     = sessionStatus[c.status] ?? sessionStatus.uploaded;
          const isOpen = openCompare === c.id;
          const hasPrev = idx < mockSessions.length - 1;
          return (
            <div
              key={c.id}
              className="rounded-2xl border overflow-hidden"
              style={{ background: S.bg, borderColor: S.border }}
            >
              <div className="flex items-center gap-3 p-4" style={{ background: S.header }}>
                <SessionNumber n={c.sessionNumber} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: S.title }}>{c.topic}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatDate(c.date)}{c.duration ? ` · ${c.duration}` : ""}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls} flex-shrink-0`}>
                  {st.label}
                </span>
                <Link
                  href={`/consultation/${c.id}`}
                  className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium flex-shrink-0 transition-colors"
                >
                  Открыть <ArrowRight size={12} />
                </Link>
              </div>
              {hasPrev && c.compareData && (
                <ComparePanel
                  data={c.compareData}
                  open={isOpen}
                  onToggle={() => setOpenCompare(isOpen ? null : c.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Real sessions
  if (realSessions.length === 0) return <Empty onUpload={onUpload} label={uploadBtnLabel} />;

  return (
    <div className="space-y-3">
      {realSessions.map((c, idx) => {
        const hasAudio      = !!(c.audio?.fileUrl ?? c.fileUrl);
        const hasTranscript = !!c.transcript?.text;
        const hasAnalysis   = !!(c.analyses?.length);
        const title         = c.title || "Консультация";
        const paymentStatus = getPaymentStatus(payments[c.id]);
        const displayTitle  = /\.(mp3|m4a|wav|ogg|webm|flac)$/i.test(title)
          ? `Консультация #${idx + 1}`
          : title;
        return (
          <div
            key={c.id}
            className="rounded-2xl border p-4 transition-colors hover:bg-[#FFFDF8]"
            style={{ background: S.bg, borderColor: S.border }}
          >
            <div className="flex items-start gap-3">
              <SessionNumber n={idx + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: S.title }}>{displayTitle}</p>
                <p className="text-xs text-stone-400 mt-0.5">{formatDate(c.createdAt ?? c.uploadedAt ?? "")}</p>
                {c.requestId && requestsMap[c.requestId] && (
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "#9C8E80" }}
                    title={requestsMap[c.requestId]}
                  >
                    Запрос: {requestsMap[c.requestId].slice(0, 50)}{requestsMap[c.requestId].length > 50 ? "…" : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPaymentFor(c)}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors flex-shrink-0"
                style={{
                  borderColor: "#D8CFBE",
                  color: "#6B5D4F",
                  background: paymentStatus === "paid" ? "#EFFAF3" : paymentStatus === "partial" ? "#FFF7E0" : "#FFF8EA",
                }}
                title="Внести оплату"
              >
                <WalletCards size={12} />
                {paymentStatus ? paymentStatusLabels[paymentStatus] : "Оплата"}
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
                style={{ width: 28, height: 28, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                title="Удалить запись"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 pl-11">
              <div className="flex flex-wrap items-center gap-1.5">
                <MiniStatus ok={hasAudio}       label="Аудио" />
                <MiniStatus ok={hasTranscript}  label="Транскрипт" />
                <MiniStatus ok={hasAnalysis}    label="Анализ" />
              </div>
              <Link
                href={`/consultation/${c.id}`}
                className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
              >
                Открыть <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        );
      })}
      <PaymentDialog
        open={Boolean(paymentFor)}
        onClose={() => setPaymentFor(null)}
        fixedConsultationId={paymentFor?.id}
        consultations={paymentConsultations}
        initial={paymentFor ? payments[paymentFor.id] ?? null : null}
        onSaved={(row) => setPayments((prev) => ({ ...prev, [row.consultationId]: row }))}
      />
    </div>
  );
}

function MiniStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ${
      ok ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"
    }`}>
      {ok ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
      {label}
    </span>
  );
}

function SessionNumber({ n }: { n: number }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
      style={{ background: S.num, borderColor: S.numBdr }}
    >
      <span className="text-xs font-semibold" style={{ color: S.numTxt }}>{n}</span>
    </div>
  );
}

function Empty({ onUpload, label }: { onUpload: () => void; label: string }) {
  return (
    <div className="text-center py-10 text-stone-400 text-sm">
      <p>Записей пока нет.</p>
      <button onClick={onUpload} className="mt-3 text-brand-500 hover:text-brand-600 font-medium transition-colors">
        {label} →
      </button>
    </div>
  );
}

function ComparePanel({
  data, open, onToggle,
}: { data: NonNullable<MockSession["compareData"]>; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderTop: `1px solid ${S.divider}` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        style={{ background: S.bg }}
      >
        <span>Сравнить с сессией {data.prevSession}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ background: S.header, borderTop: `1px solid ${S.divider}` }}>
          <p className="text-xs text-stone-500 pt-3 leading-relaxed italic">{data.requestChange}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {data.newTopics.length > 0 && (
              <TagGroup label="Новое" icon={<TrendingUp size={10} />} items={data.newTopics}
                itemCls="bg-emerald-50 text-emerald-700 border-emerald-100" labelCls="text-emerald-600" />
            )}
            {data.strengthened.length > 0 && (
              <TagGroup label="Усилилось" icon={<TrendingUp size={10} />} items={data.strengthened}
                itemCls="bg-brand-50 text-brand-600 border-brand-100" labelCls="text-brand-500" />
            )}
            {data.weakened.length > 0 && (
              <TagGroup label="Ослабло" icon={<TrendingDown size={10} />} items={data.weakened}
                itemCls="bg-rose-50 text-rose-600 border-rose-100" labelCls="text-rose-500" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TagGroup({ label, icon, items, itemCls, labelCls }: {
  label: string; icon: React.ReactNode; items: string[]; itemCls: string; labelCls: string;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${labelCls}`}>
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span key={t} className={`px-2 py-0.5 rounded-full text-xs border ${itemCls}`}>{t}</span>
        ))}
      </div>
    </div>
  );
}
