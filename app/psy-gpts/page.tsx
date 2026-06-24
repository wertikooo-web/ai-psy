"use client";

import { useState } from "react";
import { Bot, ExternalLink, Plus, X, Save } from "lucide-react";

interface GPT {
  id:          string;
  name:        string;
  description: string;
  url:         string;
}

const initialGPTs: GPT[] = [
  {
    id:          "gestalt",
    name:        "Gestalt Assistant",
    description: "Помогает применять гештальт-подход в анализе сессий: цикл контакта, фигура и фон, незавершённые ситуации.",
    url:         "https://chat.openai.com/g/g-gestalt",
  },
  {
    id:          "cbt",
    name:        "CBT Coach",
    description: "Инструмент для когнитивно-поведенческой терапии: дисфункциональные убеждения, ABC-модель, поведенческие эксперименты.",
    url:         "https://chat.openai.com/g/g-cbt",
  },
  {
    id:          "schema",
    name:        "Schema Therapy Guide",
    description: "Работа со схемами и режимами клиента. Идентификация ранних дезадаптивных схем, ограниченное родительство.",
    url:         "https://chat.openai.com/g/g-schema",
  },
  {
    id:          "trauma",
    name:        "Trauma-Informed",
    description: "Помощник для работы с травматическим опытом. Нейробиология травмы, ресурсирование, окна толерантности.",
    url:         "https://chat.openai.com/g/g-trauma",
  },
  {
    id:          "supervision",
    name:        "Supervision Support",
    description: "Поддержка в процессе супервизии. Анализ контрпереноса, сложных случаев и терапевтических отношений.",
    url:         "https://chat.openai.com/g/g-supervision",
  },
];

export default function PsyGptsPage() {
  const [gpts, setGpts]       = useState<GPT[]>(initialGPTs);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ name: "", description: "", url: "" });

  function handleAdd() {
    if (!form.name.trim() || !form.url.trim()) return;
    setGpts((prev) => [
      ...prev,
      { id: Date.now().toString(), ...form },
    ]);
    setForm({ name: "", description: "", url: "" });
    setAdding(false);
  }

  function handleRemove(id: string) {
    setGpts((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-8 max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-800">PSY-GPTs</h1>
            <p className="text-sm text-slate-400 mt-0.5">Персональные GPTs для психологической работы</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} />
            Добавить GPT
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="mb-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Новый GPT</h2>
            <div className="space-y-3">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Название"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50"
              />
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Краткое описание"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50"
              />
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://chat.openai.com/g/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={14} />
                Добавить
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gpts.map((gpt) => (
            <div
              key={gpt.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-brand-500" />
                  </div>
                  <h2 className="font-semibold text-slate-800">{gpt.name}</h2>
                </div>
                <button
                  onClick={() => handleRemove(gpt.id)}
                  className="p-1 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors"
                  title="Удалить"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-4">
                {gpt.description}
              </p>

              <a
                href={gpt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-sm font-medium transition-colors border border-slate-100 hover:border-brand-100"
              >
                Открыть GPT
                <ExternalLink size={13} />
              </a>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mt-8">
          Ссылки открываются в ChatGPT. Список сохраняется только в текущей сессии — постоянное хранение будет добавлено позже.
        </p>
      </div>
    </div>
  );
}
