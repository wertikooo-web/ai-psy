"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { consultations as mockConsultations } from "@/lib/mockData";
import type { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import { Mic, ArrowRight, Headphones, FileText, BrainCircuit, CheckCircle2, Clock, AlertCircle } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

type AnyConsultation = StoredConsultation & { isMock?: boolean; topic?: string; sessionNumber?: number; duration?: string; summary?: string; };

function StatusPill({ label, state }: { label: string; state: "ok" | "warn" | "none" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      state === "ok"   ? "bg-emerald-50 text-emerald-600" :
      state === "warn" ? "bg-amber-50 text-amber-600" :
                         "bg-slate-50 text-slate-400"
    }`}>
      {state === "ok"   ? <CheckCircle2 size={10} /> :
       state === "warn" ? <AlertCircle size={10} /> :
                          <Clock size={10} />}
      {label}
    </span>
  );
}

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
            id:              m.id,
            clientId:        m.clientId,
            clientName:      m.clientName,
            clientInitials:  m.clientInitials,
            clientColor:     m.clientColor,
            title:           m.topic,
            createdAt:       m.date,
            source:          "audio" as const,
            status:          "done" as const,
            topic:           m.topic,
            sessionNumber:   m.sessionNumber,
            duration:        m.duration,
            summary:         m.summary,
            isMock:          true,
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
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Консультации</h1>
            <p className="text-sm text-slate-400 mt-0.5">{total} {total === 1 ? "запись" : "записей"}</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={15} />
            Загрузить запись
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Консультаций пока нет. Загрузите первую запись.
          </div>
        ) : (
          <div className="space-y-3">
            {consultations.map((c, i) => {
              const num   = c.sessionNumber ?? (total - i);
              const title = c.title || c.topic || `Консультация #${num}`;
              const date  = c.createdAt;

              const hasAudio      = !!(c as StoredConsultation).audio || c.isMock;
              const hasTranscript = !!(c as StoredConsultation).transcript?.text || c.isMock;
              const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;

              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/consultation/${c.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-100 transition-all p-5 group"
                >
                  <div className="flex items-start gap-4">
                    <Avatar initials={c.clientInitials} color={c.clientColor} size="md" />

                    <div className="flex-1 min-w-0">
                      {/* Title + client */}
                      <div className="flex items-baseline gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-800">
                          Консультация #{num}
                        </span>
                        {c.duration && (
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            <Clock size={10} />
                            {c.duration}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 mb-2">
                        {c.clientName}
                        {title !== `Консультация #${num}` && (
                          <span className="text-slate-400"> · {title}</span>
                        )}
                      </div>

                      {/* Status pills */}
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill
                          label={`Аудио: ${hasAudio ? "загружено" : "нет"}`}
                          state={hasAudio ? "ok" : "none"}
                        />
                        <StatusPill
                          label={`Транскрипт: ${hasTranscript ? "готов" : "не создан"}`}
                          state={hasTranscript ? "ok" : "none"}
                        />
                        <StatusPill
                          label={`Анализ: ${hasAnalysis ? "готов" : "не создан"}`}
                          state={hasAnalysis ? "ok" : "none"}
                        />
                      </div>

                      {/* Summary */}
                      {c.summary && (
                        <p className="text-sm text-slate-400 line-clamp-1 mt-2 leading-relaxed">
                          {c.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right space-y-2">
                      <div className="text-xs text-slate-400">{formatDate(date)}</div>
                      <ArrowRight size={15} className="text-slate-200 group-hover:text-brand-400 transition-colors ml-auto" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
