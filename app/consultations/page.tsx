"use client";

import { useState } from "react";
import { consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { UploadModal } from "@/components/upload/UploadModal";
import Link from "next/link";
import { Clock, ArrowRight, Mic } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ConsultationsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Консультации</h1>
            <p className="text-sm text-slate-400 mt-0.5">{consultations.length} записей</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Mic size={15} />
            Загрузить запись
          </button>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {["Все", "Проанализировано", "Новая", "В работе"].map((label, i) => (
            <button
              key={label}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === 0
                  ? "bg-brand-500 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {consultations.map((c) => (
            <Link
              key={c.id}
              href={`/consultation/${c.id}`}
              className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-100 transition-all p-4 group"
            >
              <div className="flex items-start gap-4">
                <Avatar initials={c.clientInitials} color={c.clientColor} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800">{c.clientName}</span>
                    <span className="text-slate-300 text-sm">·</span>
                    <span className="text-sm text-slate-500">Сессия #{c.sessionNumber}</span>
                    <Badge variant={c.status} />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">{c.topic}</p>
                  {c.summary && (
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{c.summary}</p>
                  )}
                </div>

                <div className="flex-shrink-0 text-right space-y-2">
                  <div className="text-xs text-slate-400">{formatDate(c.date)}</div>
                  <div className="flex items-center justify-end gap-1 text-xs text-slate-300">
                    <Clock size={11} />
                    {c.duration}
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-slate-200 group-hover:text-brand-400 transition-colors ml-auto"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
