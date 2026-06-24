"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2, BookOpen, Zap, HelpCircle, Database, BrainCircuit } from "lucide-react";

interface SystemStatus {
  label:  string;
  state:  "ok" | "error" | "loading";
  detail: string;
}

export default function HelpPage() {
  const [statuses, setStatuses] = useState<SystemStatus[]>([
    { label: "OpenAI API",     state: "loading", detail: "" },
    { label: "База знаний",    state: "loading", detail: "" },
    { label: "Whisper",        state: "loading", detail: "" },
  ]);

  useEffect(() => {
    async function check() {
      const results: SystemStatus[] = [...statuses];

      // OpenAI
      try {
        const res  = await fetch("/api/check-connection");
        const data = await res.json();
        results[0] = {
          label:  "OpenAI API",
          state:  data.configured ? "ok" : "error",
          detail: data.configured ? `Ключ найден (${data.masked})` : "OPENAI_API_KEY не установлен",
        };
      } catch {
        results[0] = { label: "OpenAI API", state: "error", detail: "Не удалось проверить" };
      }

      // Knowledge Base
      try {
        const res   = await fetch("/api/knowledge-base");
        const files = await res.json();
        results[1] = {
          label:  "База знаний",
          state:  files.length > 0 ? "ok" : "error",
          detail: files.length > 0 ? `${files.length} файлов найдено` : "Файлы не найдены",
        };
      } catch {
        results[1] = { label: "База знаний", state: "error", detail: "Ошибка доступа к папке" };
      }

      // Whisper — same key as OpenAI
      results[2] = {
        label:  "Whisper",
        state:  results[0].state,
        detail: results[0].state === "ok" ? "Готов (whisper-1)" : "Требует OpenAI API Key",
      };

      setStatuses(results);
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>Помощь</h1>
          <p className="text-sm mt-0.5" style={{ color: "#A8997F" }}>Руководство по работе с TRANSCRIPT AI · PSY</p>
        </div>

        {/* Quick start */}
        <Section icon={<HelpCircle size={15} className="text-brand-500" />} title="Быстрый старт">
          <ol className="space-y-3">
            {[
              "Создайте клиента — перейдите в раздел Клиенты и нажмите «Добавить клиента».",
              "Добавьте консультацию — откройте карточку клиента и создайте новую запись.",
              "Загрузите аудио или готовый транскрипт через кнопку «Загрузить запись».",
              "Запустите анализ — выберите режим и нажмите кнопку анализа в консультации.",
              "Продолжите работу в чате — задавайте вопросы по сессии в правой панели.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#E4DDD0", color: "#6B5D4F" }}>
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* Analysis modes */}
        <Section icon={<BrainCircuit size={15} className="text-brand-500" />} title="Режимы анализа">
          <div className="space-y-4">
            {[
              {
                name: "Рабочий анализ",
                desc: "Быстрый клинический разбор: ключевые темы, динамика, что замечено. Подходит для регулярной работы после каждой сессии.",
              },
              {
                name: "Глубокий анализ",
                desc: "Детальный разбор с гипотезами, слоями защит, процессуальными паттернами. Для сложных случаев и супервизии.",
              },
              {
                name: "Анализ работы психолога (+A)",
                desc: "Фокус на действиях терапевта: что сработало, что можно улучшить, как развивались терапевтические отношения.",
              },
              {
                name: "Гештальт-анализ (+G)",
                desc: "Анализ через гештальт-линзу: цикл контакта, фигура/фон, полярности, незавершённые ситуации.",
              },
            ].map((m) => (
              <div key={m.name}>
                <div className="text-sm font-semibold mb-1" style={{ color: "#4A3C2E" }}>{m.name}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Knowledge base */}
        <Section icon={<BookOpen size={15} className="text-slate-500" />} title="Как работает база знаний">
          <div className="text-sm space-y-2 leading-relaxed" style={{ color: "#6B5D4F" }}>
            <p>База знаний лежит в папке <code className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>knowledge_base/</code> проекта.</p>
            <p>Главный файл <code className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>000_CORE_INSTRUCTIONS.md</code> подключается к каждому запросу.</p>
            <p>Разные режимы анализа подключают разные файлы: например, гештальт-режим читает <code className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>07_ГЕШТАЛЬТ_РЕЖИМ.md</code>.</p>
            <p>Добавить свои документы можно в разделе <strong>База знаний</strong> — форматы .md и .txt.</p>
          </div>
        </Section>

        {/* Data storage */}
        <Section icon={<Database size={15} className="text-slate-400" />} title="Где хранятся данные">
          <div className="text-sm space-y-2 leading-relaxed" style={{ color: "#6B5D4F" }}>
            <p>Сейчас данные хранятся в JSON-файлах: <code className="font-mono px-1 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>data/clients.json</code>, <code className="font-mono px-1 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>data/consultations.json</code> и др.</p>
            <p>Аудиофайлы загружаются в <code className="font-mono px-1 rounded text-xs" style={{ background: "#E8E0D0", color: "#4A3C2E" }}>public/uploads/</code>.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-amber-700">
              ⚠️ На Railway файловая система временная — данные и аудио могут быть потеряны при перезапуске сервера. В следующей версии планируется переход на Supabase.
            </div>
          </div>
        </Section>

        {/* System check */}
        <Section icon={<Zap size={15} className="text-amber-500" />} title="Проверка системы">
          <div className="space-y-3">
            {statuses.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                {s.state === "loading" ? (
                  <Loader2 size={16} className="text-slate-300 animate-spin flex-shrink-0" />
                ) : s.state === "ok" ? (
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
                )}
                <div>
                  <span className="text-sm font-medium" style={{ color: "#4A3C2E" }}>{s.label}</span>
                  {s.detail && <span className="text-sm ml-2" style={{ color: "#A8997F" }}>{s.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
      <div className="px-6 py-4 border-b flex items-center gap-3" style={{ background: "#E8E0D0", borderColor: "#DDD4C6" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#DDD4C6" }}>{icon}</div>
        <h2 className="text-sm font-semibold" style={{ color: "#4A3C2E" }}>{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
