"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { consultations as mockConsultations } from "@/lib/mockData";
import type { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import {
  Mic, ArrowRight, ArrowLeft, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

const CARD_BG = "#F4F0E8";
const TAB_BG  = "#C9BBAA";
const TAB_HOV = "#BEB09E";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

type AnyConsultation = StoredConsultation & {
  isMock?: boolean; topic?: string; sessionNumber?: number;
  duration?: string; summary?: string;
};

function Badge({ label, state }: { label: string; state: "ok" | "warn" | "none" }) {
  const styles = {
    ok:   "bg-emerald-50 text-emerald-600 border border-emerald-100",
    warn: "bg-amber-50 text-amber-600 border border-amber-100",
    none: "bg-stone-100 text-stone-400 border border-stone-200",
  }[state];
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? AlertCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ConsultationCard({
  c, num, onOpen,
}: { c: AnyConsultation; num: number; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);

  const title         = c.title || c.topic || `Консультация #${num}`;
  const showTopic     = title !== `Консультация #${num}`;
  const hasTranscript = !!(c as StoredConsultation).transcript?.text || c.isMock;
  const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;

  return (
    <div
      className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{ background: CARD_BG, borderColor: "#DDD4C6" }}
    >
      {/* ── Body: desktop = horizontal, mobile = vertical ── */}
      <div className="px-4 sm:px-5 pt-4 pb-3">

        {/* ── Mobile layout (< sm) ── */}
        <div className="flex sm:hidden items-center gap-3 mb-2">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
          <span className="text-sm font-medium text-slate-700 truncate">{c.clientName}</span>
        </div>

        <div className="sm:hidden">
          {/* Session # + duration */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-800 text-sm">Консультация #{num}</span>
            {c.duration && (
              <span className="text-xs text-stone-400 flex items-center gap-0.5">
                <Clock size={10} />
                {c.duration}
              </span>
            )}
          </div>
          {/* Topic */}
          {showTopic && (
            <p className="text-xs text-stone-400 line-clamp-1 mb-0.5">{title}</p>
          )}
          {/* Date */}
          <p className="text-xs text-stone-400 mb-1">{formatDate(c.createdAt)}</p>
          {/* Summary */}
          {c.summary && (
            <p className="text-sm text-stone-400 line-clamp-2 leading-relaxed">{c.summary}</p>
          )}
        </div>

        {/* ── Desktop layout (≥ sm) ── */}
        <div className="hidden sm:flex items-start gap-4">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">Консультация #{num}</span>
              {c.duration && (
                <span className="text-xs text-stone-400 flex items-center gap-0.5">
                  <Clock size={10} />
                  {c.duration}
                </span>
              )}
            </div>
            <div className="text-sm text-stone-500 mt-0.5">
              {c.clientName}
              {showTopic && <span className="text-stone-400"> · {title}</span>}
            </div>
            {c.summary && (
              <p className="text-sm text-stone-400 line-clamp-2 mt-1 leading-relaxed">{c.summary}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-xs text-stone-400 pt-0.5">
            {formatDate(c.createdAt)}
          </div>
        </div>
      </div>

      {/* ── Status badges ── */}
      <div className="px-4 sm:px-5 pb-4 flex flex-wrap gap-1.5">
        <Badge
          label={hasTranscript ? "Транскрипт готов" : "Транскрипт не создан"}
          state={hasTranscript ? "ok" : "none"}
        />
        <Badge
          label={hasAnalysis ? "Анализ готов" : "Анализ не готов"}
          state={hasAnalysis ? "ok" : "none"}
        />
      </div>

      {/* ── CTA ── */}
      <button
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 text-sm font-medium rounded-b-2xl"
        style={{
          background: hovered ? TAB_HOV : TAB_BG,
          color:      "#4A3F32",
          borderTop:  "1px solid #B8AC9A",
          boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition: "background 0.15s ease",
        }}
      >
        <span>Открыть консультацию</span>
        <ArrowRight
          size={14}
          className="text-stone-500 transition-transform duration-150"
          style={{ transform: hovered ? "translateX(3px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen]       = useState(false);
  const [consultations, setConsultations] = useState<AnyConsultation[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/consultations");
        const real: StoredConsultation[] = res.ok ? await res.json() : [];
        const realIds = new Set(real.map((c) => c.id));
        const mock = mockConsultations
          .filter((m) => !realIds.has(m.id))
          .map((m) => ({
            id:             m.id,
            clientId:       m.clientId,
            clientName:     m.clientName,
            clientInitials: m.clientInitials,
            clientColor:    m.clientColor,
            title:          m.topic,
            createdAt:      m.date,
            source:         "audio" as const,
            status:         "done"  as const,
            topic:          m.topic,
            sessionNumber:  m.sessionNumber,
            duration:       m.duration,
            summary:        m.summary,
            isMock:         true,
          } as AnyConsultation));
        setConsultations([...real, ...mock]);
      } catch {
        setConsultations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = consultations.length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="px-4 py-6 sm:p-8 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: "#A8997F" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#4A3C2E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; }}
            >
              <ArrowLeft size={16} />
              Назад
            </button>
            <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
            <h1 className="text-xl font-bold text-slate-800">Консультации</h1>
          </div>

          {/* Desktop button */}
          <button
            onClick={() => setUploadOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={15} />
            Загрузить запись
          </button>

          {/* Mobile button — icon + short label */}
          <button
            onClick={() => setUploadOpen(true)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={15} />
            Загрузить
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border h-28 animate-pulse"
                style={{ background: CARD_BG, borderColor: "#DDD4C6" }}
              />
            ))}
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-sm">
            Консультаций пока нет. Загрузите первую запись.
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {consultations.map((c, i) => (
              <ConsultationCard
                key={c.id}
                c={c}
                num={c.sessionNumber ?? (total - i)}
                onOpen={() => router.push(`/consultation/${c.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
