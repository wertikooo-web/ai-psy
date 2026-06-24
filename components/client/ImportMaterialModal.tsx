"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { MATERIAL_TYPE_LABELS, type MaterialType, type ClientMaterial } from "@/lib/types";

const TYPES: MaterialType[] = [
  "general_history",
  "gpt_analysis",
  "past_transcript",
  "other",
];

interface Props {
  open: boolean;
  clientId: string;
  onClose: () => void;
  onImported: (m: ClientMaterial) => void;
}

export function ImportMaterialModal({ open, clientId, onClose, onImported }: Props) {
  const [type, setType]       = useState<MaterialType>("general_history");
  const [content, setContent] = useState("");
  const [title, setTitle]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  if (!open) return null;

  function reset() {
    setType("general_history");
    setContent("");
    setTitle("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) { setError("Вставьте или введите текст материала"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/client-materials/${clientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, content: content.trim(), title: title.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      const m = await res.json();
      onImported(m);
      reset();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={17} className="text-brand-500" />
            <h2 className="text-base font-semibold text-slate-800">Импортировать материалы</h2>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Тип материала</label>
            <div className="grid grid-cols-1 gap-1.5">
              {TYPES.map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    type === t
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="sr-only"
                  />
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                    type === t ? "border-brand-500 bg-brand-500" : "border-slate-300"
                  }`} />
                  <span className="text-sm">{MATERIAL_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Название <span className="font-normal text-slate-400">(опционально)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={MATERIAL_TYPE_LABELS[type]}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Текст материала <span className="text-rose-400">*</span>
            </label>
            <textarea
              autoFocus
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Вставьте текст из другой системы, скопируйте историю клиента, заметки или анализ..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all resize-none leading-relaxed"
            />
            {content.length > 0 && (
              <p className="text-xs text-slate-400 mt-1 text-right">{content.length} символов</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-500 bg-rose-50 rounded-xl px-3.5 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white text-sm font-medium transition-colors"
            >
              {loading ? "Сохраняю..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
