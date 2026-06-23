"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddClientModal({ open, onClose, onCreated }: Props) {
  const [name, setName]       = useState("");
  const [age, setAge]         = useState("");
  const [concern, setConcern] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Введите имя клиента"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), age: age || undefined, concern: concern.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ошибка");
      }
      setName(""); setAge(""); setConcern("");
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-brand-500" />
            <h2 className="text-base font-semibold text-slate-800">Новый клиент</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Имя <span className="text-rose-400">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Анна Соколова"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Возраст</label>
            <input
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="34"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Запрос / причина обращения</label>
            <textarea
              rows={3}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="Тревожное расстройство, сложности в отношениях..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-500 bg-rose-50 rounded-xl px-3.5 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white text-sm font-medium transition-colors"
            >
              {loading ? "Сохраняю..." : "Добавить клиента"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
