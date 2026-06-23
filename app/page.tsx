"use client";

import { useState } from "react";
import { consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import Link from "next/link";
import { ArrowRight, Mic } from "lucide-react";

const aiObservations = [
  {
    id: "o1",
    clientName: "Анна Соколова",
    clientInitials: "АС",
    clientColor: "#6088ff",
    consultationId: "con1",
    text: "Впервые самостоятельно связала избегание со страхом отвержения — без подсказки терапевта. Стоит остановиться на этом в следующей встрече.",
  },
  {
    id: "o2",
    clientName: "Елена Громова",
    clientInitials: "ЕГ",
    clientColor: "#e06060",
    consultationId: "con3",
    text: "Первый раз подробно описала начало панических атак. Тема семейного давления всплыла сама — не в ответ на вопрос.",
  },
];

const needsAttention = {
  clientName: "Михаил Орлов",
  clientInitials: "МО",
  clientColor: "#4f8e4f",
  consultationId: "con2",
  text: "Три встречи подряд возвращается к теме «потери себя» после повышения — тема ещё не открыта полностью.",
};

export default function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const recent = consultations.slice(0, 4);

  return (
    <>
      <div className="p-8 max-w-2xl mx-auto space-y-10">

        {/* Greeting + action */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Добрый день, Наталья</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {new Date().toLocaleDateString("ru-RU", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={14} />
            Загрузить запись
          </button>
        </div>

        {/* AI surface: what it noticed */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Что AI заметил на этой неделе
          </h2>
          <div className="space-y-3">
            {aiObservations.map((obs) => (
              <Link
                key={obs.id}
                href={`/consultation/${obs.consultationId}`}
                className="flex gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-brand-100 hover:shadow-sm transition-all group"
              >
                <Avatar initials={obs.clientInitials} color={obs.clientColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 mb-1">{obs.clientName}</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic">{obs.text}</p>
                </div>
                <ArrowRight size={14} className="text-slate-200 group-hover:text-brand-400 transition-colors flex-shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </section>

        {/* Needs attention */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Требует внимания
          </h2>
          <Link
            href={`/consultation/${needsAttention.consultationId}`}
            className="flex gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all group"
          >
            <Avatar initials={needsAttention.clientInitials} color={needsAttention.clientColor} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 mb-1">{needsAttention.clientName}</p>
              <p className="text-sm text-slate-600 leading-relaxed italic">{needsAttention.text}</p>
            </div>
            <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-0.5" />
          </Link>
        </section>

        {/* Recent sessions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Последние встречи
            </h2>
            <Link href="/consultations" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              Все встречи →
            </Link>
          </div>
          <div className="space-y-1">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/consultation/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
              >
                <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700">{c.clientName}</span>
                  <span className="text-slate-300 mx-2">·</span>
                  <span className="text-sm text-slate-400 truncate">{c.topic}</span>
                </div>
                <ArrowRight size={13} className="text-slate-200 group-hover:text-brand-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>

      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
