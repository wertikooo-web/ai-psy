"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, BrainCircuit, ShieldCheck, Layers, Sparkles } from "lucide-react";

const SECTION = "rounded-2xl border p-6 shadow-sm";
const S = { background: "#F0EBE1", borderColor: "#DDD4C6" } as const;

function Block({ children }: { children: React.ReactNode }) {
  return <div className={SECTION} style={S}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "#A8997F" }}>
      {children}
    </h2>
  );
}

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
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
          <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>About</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: "#C9BBAA" }}>О приложении и команде</p>

        <div className="space-y-4">

          {/* Identity */}
          <Block>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#E8E0D0" }}>
                <BrainCircuit size={22} style={{ color: "#6B5D4F" }} />
              </div>
              <div>
                <h2 className="text-base font-bold mb-1" style={{ color: "#3D3228" }}>TRANSCRIPT AI · PSY</h2>
                <p className="text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
                  Инструмент для практикующих психологов. Помогает расшифровывать записи сессий,
                  анализировать их через призму разных терапевтических подходов и вести
                  структурированную историю клиентов — без лишней рутины.
                </p>
              </div>
            </div>
          </Block>

          {/* How it works */}
          <Block>
            <Label><Layers size={13} />Как устроено</Label>
            <ul className="space-y-2.5">
              {[
                "Транскрипция аудиозаписей через OpenAI Whisper",
                "Анализ через GPT-4o с базой знаний, настроенной под психологическую практику",
                "Четыре режима анализа: рабочий, глубокий, анализ работы психолога, гештальт",
                "База знаний настраивается под ваш стиль и подход",
                "PSY-GPTs — специализированные AI-ассистенты для профессиональных задач",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "#6B5D4F" }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#C9BBAA" }} />
                  {item}
                </li>
              ))}
            </ul>
          </Block>

          {/* Privacy */}
          <Block>
            <Label><ShieldCheck size={13} />Приватность</Label>
            <p className="text-sm leading-relaxed" style={{ color: "#6B5D4F" }}>
              Данные клиентов хранятся локально на вашем сервере и никуда не передаются.
              OpenAI получает только текст транскрипта для анализа — без имён, без личных данных,
              без привязки к конкретному человеку. История клиентов остаётся только у вас.
            </p>
          </Block>

          {/* Roadmap */}
          <Block>
            <Label><Sparkles size={13} />Планируется</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Мобильное приложение",
                "Автоматическая синхронизация базы знаний",
                "Шаблоны отчётов для супервизии",
                "Двусторонняя синхронизация с Google Calendar",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm" style={{ color: "#A8997F" }}>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#C9BBAA" }} />
                  {item}
                </div>
              ))}
            </div>
          </Block>

          {/* Contacts */}
          <Block>
            <Label><Mail size={13} />Контакты</Label>
            <div className="space-y-3">
              <a
                href="mailto:wertikoo@yahoo.com"
                className="flex items-center gap-3 text-sm transition-colors"
                style={{ color: "#6B5D4F" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#3D3228"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B5D4F"; }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#E8E0D0" }}>
                  <Mail size={14} style={{ color: "#A8997F" }} />
                </div>
                <span>wertikoo@yahoo.com</span>
              </a>
              <div className="flex items-center gap-3 text-sm" style={{ color: "#6B5D4F" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#E8E0D0" }}>
                  <Phone size={14} style={{ color: "#A8997F" }} />
                </div>
                <span>+373 79 676 487</span>
              </div>
            </div>
          </Block>

          {/* Version + copyright */}
          <div className="text-center pt-2 space-y-1">
            <div className="text-xs" style={{ color: "#C9BBAA" }}>
              TRANSCRIPT AI · PSY · Версия 1.0 · 2026
            </div>
            <div className="text-xs" style={{ color: "#C9BBAA" }}>
              © 2026 Transcript AI · PSY. All rights reserved.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
