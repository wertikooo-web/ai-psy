"use client";

import { CompareData } from "@/lib/mockData";
import { X, TrendingUp, TrendingDown, Sparkles, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  data: CompareData;
  clientName: string;
}

export function CompareModal({ open, onClose, data, clientName }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-slate-800">Сравнение сессий</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{clientName}</span>
              <span className="flex items-center gap-1 font-medium text-slate-500">
                Сессия {data.prevSession}
                <ArrowRight size={11} />
                Сессия {data.currSession}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">

          {/* New topics */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-[9px] text-brand-600 font-bold">N</span>
              </div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Новые темы</h3>
            </div>
            <ul className="space-y-1.5">
              {data.newTopics.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{t}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="border-t border-slate-50" />

          {/* Strengthened */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Усилилось</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.strengthened.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium"
                >
                  ↑ {t}
                </span>
              ))}
            </div>
          </section>

          {/* Weakened */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown size={14} className="text-amber-500" />
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Ослабло</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.weakened.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-100 font-medium"
                >
                  ↓ {t}
                </span>
              ))}
            </div>
          </section>

          <div className="border-t border-slate-50" />

          {/* Request change */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">🔁</span>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Изменения в запросе</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3">
              {data.requestChange}
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
