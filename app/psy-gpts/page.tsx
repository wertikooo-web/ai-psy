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
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "#F8F4EC" }}>
      <div className="p-8 max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>PSY-GPTs</h1>
            <p className="text-sm mt-0.5" style={{ color: "#A8997F" }}>Персональные GPTs для психологической работы</p>
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
          <div className="mb-6 rounded-2xl border shadow-sm p-5" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#4A3C2E" }}>Новый GPT</h2>
            <div className="space-y-3">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Название"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 placeholder:text-stone-300"
                style={{ background: "#FAF7F1", borderColor: "#D4C9B5", color: "#3D3228" }}
              />
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Краткое описание"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 placeholder:text-stone-300"
                style={{ background: "#FAF7F1", borderColor: "#D4C9B5", color: "#3D3228" }}
              />
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://chat.openai.com/g/..."
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 placeholder:text-stone-300"
                style={{ background: "#FAF7F1", borderColor: "#D4C9B5", color: "#3D3228" }}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 py-2 rounded-xl border text-sm transition-colors"
                style={{ borderColor: "#D4C9B5", color: "#6B5D4F", background: "#EDE7DA" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#E4DDD0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#EDE7DA"; }}
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
              className="rounded-2xl border shadow-sm transition-all flex flex-col overflow-hidden"
              style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}
            >
              <div className="flex items-start justify-between px-5 py-4 border-b" style={{ background: "#E8E0D0", borderColor: "#DDD4C6" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#DDD4C6" }}>
                    <Bot size={18} style={{ color: "#6B5D4F" }} />
                  </div>
                  <h2 className="font-semibold" style={{ color: "#4A3C2E" }}>{gpt.name}</h2>
                </div>
                <button
                  onClick={() => handleRemove(gpt.id)}
                  className="p-1 rounded-lg text-stone-300 hover:text-rose-400 hover:bg-rose-50 transition-colors"
                  title="Удалить"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 py-4 flex-1 flex flex-col">
                <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: "#6B5D4F" }}>
                  {gpt.description}
                </p>

                <a
                  href={gpt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-b-2xl -mx-5 -mb-4 text-sm font-medium transition-colors border-t"
                  style={{ background: "#C9BBAA", color: "#4A3C2E", borderColor: "#D4C9B5" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#BEB09E"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#C9BBAA"; }}
                >
                  Открыть GPT
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-center mt-8" style={{ color: "#C9BBAA" }}>
          Ссылки открываются в ChatGPT. Список сохраняется только в текущей сессии — постоянное хранение будет добавлено позже.
        </p>
      </div>
    </div>
  );
}
