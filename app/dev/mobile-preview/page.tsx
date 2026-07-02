"use client";

import React, { useState } from "react";
import {
  Home, Users, FileText, BookOpen, MoreHorizontal, ChevronLeft, Plus,
  Search, Mic, Calendar, CreditCard, BarChart2, Settings, ChevronRight,
  CheckCircle2, Clock, MessageSquare, Brain, Scroll, X, Edit3, Trash2,
  Phone, Mail, User, ArrowLeft, Star, Activity, Zap,
} from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:        "#FBF8F5",
  card:      "#F3EBDD",
  cardHov:   "#D4C5B1",
  border:    "#CFC0A9",
  dark:      "#3D3228",
  mid:       "#6B5D4F",
  light:     "#A8997F",
  muted:     "#C9BBAA",
  brand:     "#3a5ff8",
  brandLt:   "#E8EDFF",
  green:     "#16a34a",
  greenLt:   "#dcfce7",
  amber:     "#d97706",
  amberLt:   "#fef3c7",
  red:       "#dc2626",
  redLt:     "#fee2e2",
};

// ── Screen IDs ─────────────────────────────────────────────────────────────────
type Screen =
  | "home" | "clients" | "client-detail"
  | "consultations" | "consultation-detail"
  | "notebook" | "calendar" | "payments"
  | "analytics" | "settings" | "more";

type NavEntry = { screen: Screen; title?: string; id?: string };

// ── Mock data ──────────────────────────────────────────────────────────────────
const CLIENTS = [
  { id: "1", name: "Анна Ковалёва",   initials: "АК", color: "#7C9A6E", sessions: 12, lastDate: "3 июл", status: "active" },
  { id: "2", name: "Михаил Дронов",   initials: "МД", color: "#7A8FC4", sessions: 5,  lastDate: "1 июл", status: "active" },
  { id: "3", name: "Елена Морозова",  initials: "ЕМ", color: "#C47A7A", sessions: 8,  lastDate: "28 июн", status: "active" },
  { id: "4", name: "Сергей Петров",   initials: "СП", color: "#9B8EC4", sessions: 3,  lastDate: "20 июн", status: "archived" },
];

const CONSULTATIONS = [
  { id: "1", clientName: "Анна Ковалёва",  initials: "АК", color: "#7C9A6E", title: "Тревога и контроль",   date: "3 июл", status: "done",    hasAnalysis: true  },
  { id: "2", clientName: "Михаил Дронов",  initials: "МД", color: "#7A8FC4", title: "Отношения с отцом",    date: "1 июл", status: "done",    hasAnalysis: true  },
  { id: "3", clientName: "Елена Морозова", initials: "ЕМ", color: "#C47A7A", title: "Выгорание на работе",  date: "28 июн", status: "done",   hasAnalysis: false },
  { id: "4", clientName: "Анна Ковалёва",  initials: "АК", color: "#7C9A6E", title: "Сессия #11 — итоги",   date: "25 июн", status: "done",   hasAnalysis: true  },
];

const NOTEBOOK = [
  { id: "1", title: "Паттерн избегания",         text: "У Анны снова проявился паттерн избегания конфликта через соматику — жалобы на давление перед сложными разговорами...", date: "2 июл", client: "Анна Ковалёва" },
  { id: "2", title: "Перенос с матерью",          text: "Михаил начинает переносить образ матери на рабочих коллег, особенно на руководство...", date: "1 июл", client: "Михаил Дронов" },
  { id: "3", title: "Ресурсное состояние",        text: "Важно отметить момент, когда клиентка описывала детские воспоминания о море — видимый ресурс...", date: "29 июн", client: null },
];

// ── Avatar component ───────────────────────────────────────────────────────────
function Av({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, color: "#fff", fontSize: size * 0.36, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ background: bg, color, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99 }}>
      {text}
    </span>
  );
}

// ── Mobile header ──────────────────────────────────────────────────────────────
function MHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "12px 16px 10px", borderBottom: `1px solid ${T.border}`,
      background: T.bg, flexShrink: 0,
    }}>
      {onBack && (
        <button onClick={onBack} style={{ color: T.brand, background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <ChevronLeft size={22} />
        </button>
      )}
      <span style={{ fontWeight: 700, fontSize: 17, color: T.dark, flex: 1 }}>{title}</span>
      {right}
    </div>
  );
}

// ── Search bar ─────────────────────────────────────────────────────────────────
function SearchBar({ placeholder }: { placeholder?: string }) {
  return (
    <div style={{ padding: "10px 16px 8px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: "8px 12px",
      }}>
        <Search size={14} color={T.muted} />
        <span style={{ fontSize: 14, color: T.muted }}>{placeholder ?? "Поиск..."}</span>
      </div>
    </div>
  );
}

// ── ─────────────────────────────────────────────────────────────────────────────
//    SCREENS
// ── ─────────────────────────────────────────────────────────────────────────────

function HomeScreen({ nav }: { nav: (s: Screen, opts?: Partial<NavEntry>) => void }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div style={{ padding: "20px 16px 12px", background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Av initials="НП" color="#7C9A6E" size={40} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.dark }}>Добро пожаловать!</div>
            <div style={{ fontSize: 12, color: T.light }}>Среда, 2 июля 2026</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => nav("clients")} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 0", background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 12, fontSize: 13, fontWeight: 500, color: T.mid, cursor: "pointer",
          }}>
            <Users size={15} /> Клиенты
          </button>
          <button style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 0", background: T.brand, border: "none",
            borderRadius: 12, fontSize: 13, fontWeight: 500, color: "#fff", cursor: "pointer",
          }}>
            <Mic size={15} /> Запись
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 1, borderBottom: `1px solid ${T.border}`, background: T.border }}>
        {[
          { label: "Клиентов", value: "4", icon: <Users size={14} /> },
          { label: "Сессий", value: "28", icon: <FileText size={14} /> },
          { label: "Этот месяц", value: "6", icon: <Calendar size={14} /> },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: T.bg, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: T.light, marginBottom: 2 }}>
              {s.icon}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.dark }}>{s.value}</div>
            <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <div style={{ padding: "14px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: T.light }}>
            Последние клиенты
          </span>
          <button onClick={() => nav("clients")} style={{ fontSize: 11, color: T.brand, background: "none", border: "none", cursor: "pointer" }}>
            Все →
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CLIENTS.slice(0, 3).map((c) => (
            <button key={c.id} onClick={() => nav("client-detail", { id: c.id, title: c.name })} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%",
            }}>
              <Av initials={c.initials} color={c.color} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>{c.name}</div>
                <div style={{ fontSize: 11, color: T.light }}>{c.sessions} сессий · {c.lastDate}</div>
              </div>
              <ChevronRight size={16} color={T.muted} />
            </button>
          ))}
        </div>
      </div>

      {/* Recent consultations */}
      <div style={{ padding: "4px 16px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: T.light }}>
            Последние консультации
          </span>
          <button onClick={() => nav("consultations")} style={{ fontSize: 11, color: T.brand, background: "none", border: "none", cursor: "pointer" }}>
            Все →
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CONSULTATIONS.slice(0, 2).map((c) => (
            <button key={c.id} onClick={() => nav("consultation-detail", { id: c.id, title: c.title })} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%",
            }}>
              <Av initials={c.initials} color={c.color} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.clientName}
                </div>
                <div style={{ fontSize: 11, color: T.light, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: T.muted }}>{c.date}</div>
                {c.hasAnalysis && (
                  <div style={{ fontSize: 10, color: T.green, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end", marginTop: 2 }}>
                    <CheckCircle2 size={9} /> анализ
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientsScreen({ nav }: { nav: (s: Screen, opts?: Partial<NavEntry>) => void }) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const filtered = CLIENTS.filter((c) => c.status === tab);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader
        title="Клиенты"
        right={
          <button style={{ background: T.brand, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={13} /> Новый
          </button>
        }
      />
      <SearchBar placeholder="Поиск клиентов..." />
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {(["active", "archived"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0", fontSize: 13, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? T.brand : T.light,
            borderBottom: tab === t ? `2px solid ${T.brand}` : "2px solid transparent",
            background: "none", border: "none", cursor: "pointer",
          }}>
            {t === "active" ? "Активные" : "Архив"}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((c) => (
          <button key={c.id} onClick={() => nav("client-detail", { id: c.id, title: c.name })} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%",
          }}>
            <Av initials={c.initials} color={c.color} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.dark }}>{c.name}</div>
              <div style={{ fontSize: 11, color: T.light, marginTop: 2 }}>
                {c.sessions} сессий · последняя {c.lastDate}
              </div>
            </div>
            <ChevronRight size={16} color={T.muted} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ClientDetailScreen({ id, goBack, nav }: { id: string; goBack: () => void; nav: (s: Screen, opts?: Partial<NavEntry>) => void }) {
  const client = CLIENTS.find((c) => c.id === id) ?? CLIENTS[0];
  const [tab, setTab] = useState<"overview" | "sessions" | "history" | "materials">("overview");
  const myConsults = CONSULTATIONS.filter((c) => c.clientName === client.name);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title={client.name} onBack={goBack} />

      {/* Client card */}
      <div style={{ padding: "14px 16px", background: T.card, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Av initials={client.initials} color={client.color} size={56} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.dark }}>{client.name}</div>
            <div style={{ fontSize: 12, color: T.light, marginTop: 2 }}>{client.sessions} сессий</div>
            <div style={{ marginTop: 6 }}>
              <Badge text="Активный" bg={T.greenLt} color={T.green} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0, overflowX: "auto" }}>
        {[
          { id: "overview",   label: "Обзор" },
          { id: "sessions",   label: "Консультации" },
          { id: "history",    label: "История" },
          { id: "materials",  label: "Материалы" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
            flexShrink: 0, padding: "9px 14px", fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? T.brand : T.light,
            borderBottom: tab === t.id ? `2px solid ${T.brand}` : "2px solid transparent",
            background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.light, marginBottom: 6 }}>Краткое описание</div>
              <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.5 }}>
                Клиентка обращается с запросом на работу с тревожностью и паттернами контроля. Наблюдается избегающий тип привязанности.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Сессий", value: String(client.sessions), icon: <FileText size={14} /> },
                { label: "Последняя", value: client.lastDate, icon: <Calendar size={14} /> },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: T.light }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.dark }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => nav("consultation-detail", { id: "1", title: "Новая консультация" })} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 0", background: T.brand, border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer",
            }}>
              <Plus size={15} /> Новая консультация
            </button>
          </div>
        )}

        {tab === "sessions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myConsults.map((c) => (
              <button key={c.id} onClick={() => nav("consultation-detail", { id: c.id, title: c.title })} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.hasAnalysis ? T.green : T.muted, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: T.light }}>{c.date}</div>
                </div>
                {c.hasAnalysis && <Badge text="анализ" bg={T.greenLt} color={T.green} />}
                <ChevronRight size={14} color={T.muted} />
              </button>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { title: "Ключевые темы", count: 4, color: "#7C9A6E" },
              { title: "Рабочие гипотезы", count: 2, color: "#7A8FC4" },
              { title: "Ресурсы клиента", count: 3, color: "#C47A7A" },
              { title: "Значимые события", count: 5, color: "#9B8EC4" },
              { title: "Заметки психолога", count: 7, color: T.amber },
            ].map((s) => (
              <div key={s.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 14px", borderLeft: `4px solid ${s.color}`, borderRadius: "12px 12px 0 0",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{s.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{s.count}</span>
                    <ChevronRight size={14} color={T.muted} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "materials" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={16} color="#DC2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>Первичный анализ.pdf</div>
                <div style={{ fontSize: 11, color: T.light }}>2.1 МБ · 20 июн</div>
              </div>
              <ChevronRight size={14} color={T.muted} />
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: T.brandLt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={16} color={T.brand} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>Анамнез клиентки</div>
                <div style={{ fontSize: 11, color: T.light }}>Заметка · 15 мая</div>
              </div>
              <ChevronRight size={14} color={T.muted} />
            </div>
            <button style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 0", background: T.card, border: `1px dashed ${T.border}`,
              borderRadius: 12, fontSize: 13, color: T.light, cursor: "pointer", marginTop: 4,
            }}>
              <Plus size={14} /> Добавить материал
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsultationsScreen({ nav }: { nav: (s: Screen, opts?: Partial<NavEntry>) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Консультации" right={
        <button style={{ background: T.brand, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={13} /> Новая
        </button>
      } />
      <SearchBar placeholder="Поиск консультаций..." />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {CONSULTATIONS.map((c) => (
          <button key={c.id} onClick={() => nav("consultation-detail", { id: c.id, title: c.title })} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%",
          }}>
            <Av initials={c.initials} color={c.color} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.clientName}
              </div>
              <div style={{ fontSize: 12, color: T.light, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                {c.title}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: T.muted }}>{c.date}</div>
              <div style={{ marginTop: 3 }}>
                {c.hasAnalysis
                  ? <Badge text="анализ" bg={T.greenLt} color={T.green} />
                  : <Badge text="транскрипт" bg={T.amberLt} color={T.amber} />}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsultationDetailScreen({ id, goBack }: { id: string; goBack: () => void }) {
  const c = CONSULTATIONS.find((x) => x.id === id) ?? CONSULTATIONS[0];
  const [tab, setTab] = useState<"transcript" | "analysis" | "chat">("transcript");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title={c.clientName} onBack={goBack} />

      {/* Consultation info */}
      <div style={{ padding: "10px 16px", background: T.card, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>{c.title}</div>
        <div style={{ fontSize: 12, color: T.light, marginTop: 2 }}>{c.date} · 55 мин</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
        {[
          { id: "transcript", label: "Транскрипт", icon: <Scroll size={12} /> },
          { id: "analysis",   label: "AI Анализ",  icon: <Brain size={12} /> },
          { id: "chat",       label: "Чат",         icon: <MessageSquare size={12} /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "8px 4px", fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? T.brand : T.light,
            borderBottom: tab === t.id ? `2px solid ${T.brand}` : "2px solid transparent",
            background: "none", border: "none", cursor: "pointer",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {tab === "transcript" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { speaker: "Клиент", text: "Я снова чувствую эту тревогу когда нужно принять решение. Даже маленькое." },
              { speaker: "Терапевт", text: "Расскажите, что именно происходит в теле в этот момент?" },
              { speaker: "Клиент", text: "Сжимается в груди, дыхание становится поверхностным. И мысли начинают крутиться по кругу." },
              { speaker: "Терапевт", text: "Это похоже на то, что мы уже исследовали — реакция контроля." },
              { speaker: "Клиент", text: "Да, именно. Я понимаю это уже, но телу всё равно страшно." },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: m.speaker === "Терапевт" ? T.brand : T.mid, textTransform: "uppercase" }}>
                  {m.speaker}
                </div>
                <div style={{
                  fontSize: 13, color: T.dark, lineHeight: 1.5, padding: "10px 12px",
                  background: m.speaker === "Терапевт" ? T.brandLt : T.card,
                  borderRadius: 10, border: `1px solid ${T.border}`,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { title: "Рабочий анализ", icon: <Zap size={14} />, color: "#7A8FC4", text: "Клиентка демонстрирует тревожно-контролирующий паттерн при принятии решений. Соматическая реакция (сжатие в груди) является телесным маркером активации этого паттерна." },
              { title: "Динамика сессии", icon: <Activity size={14} />, color: "#7C9A6E", text: "Хорошая работа с телесным осознаванием. Клиентка способна наблюдать реакцию без слияния с ней — признак роста терапевтического пространства." },
              { title: "Направления", icon: <Star size={14} />, color: "#C47A7A", text: "Исследовать связь контролирующего паттерна с ранними отношениями. Возможный ресурс: моменты когда тревога отступала." },
            ].map((s) => (
              <div key={s.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: s.color + "15", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.dark }}>{s.title}</span>
                </div>
                <div style={{ padding: "10px 14px", fontSize: 13, color: T.mid, lineHeight: 1.55 }}>{s.text}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: T.brandLt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.brand, marginBottom: 4 }}>AI Ассистент</div>
              <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.5 }}>
                Я готов помочь вам исследовать материал этой сессии. Что вас интересует больше всего?
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.mid, marginBottom: 4 }}>Вы</div>
              <div style={{ fontSize: 13, color: T.dark }}>Как связан паттерн контроля с тревогой?</div>
            </div>
            <div style={{ background: T.brandLt, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.brand, marginBottom: 4 }}>AI Ассистент</div>
              <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.5 }}>
                Контроль часто выступает как защитная стратегия от тревоги: иллюзия управления снижает ощущение угрозы. Однако чем сильнее контроль, тем выше тревога при его утрате...
              </div>
            </div>
            <div style={{ position: "sticky", bottom: 0, background: T.bg, paddingTop: 8 }}>
              <div style={{
                display: "flex", gap: 8, alignItems: "center",
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 12px",
              }}>
                <input placeholder="Спросить об этой сессии..." style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.dark }} readOnly />
                <button style={{ background: T.brand, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, cursor: "pointer" }}>→</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotebookScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Блокнот" right={
        <button style={{ background: T.brand, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={13} /> Запись
        </button>
      } />
      <SearchBar placeholder="Поиск в блокноте..." />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {NOTEBOOK.map((n) => (
          <div key={n.id} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.dark }}>{n.title}</div>
              <div style={{ fontSize: 10, color: T.muted, flexShrink: 0 }}>{n.date}</div>
            </div>
            {n.client && <Badge text={n.client} bg={T.brandLt} color={T.brand} />}
            <div style={{ fontSize: 12, color: T.mid, lineHeight: 1.5, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {n.text}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
              <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 0 }}><Edit3 size={13} /></button>
              <button style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 0 }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarScreen() {
  const days = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const dates = Array.from({ length: 31 }, (_, i) => i + 1);
  const today = 2;
  const withSessions = [3, 7, 10, 14, 17];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Календарь" right={
        <button style={{ background: T.brand, border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={13} />
        </button>
      } />
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button style={{ background: "none", border: "none", color: T.brand, cursor: "pointer", fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.dark }}>Июль 2026</span>
          <button style={{ background: "none", border: "none", color: T.brand, cursor: "pointer", fontSize: 18 }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
          {days.map((d) => (
            <div key={d} style={{ fontSize: 10, color: T.muted, fontWeight: 600, padding: "2px 0" }}>{d}</div>
          ))}
          {/* Empty first cells (July 1 = Wednesday = index 2) */}
          {[0, 1].map((i) => <div key={`e${i}`} />)}
          {dates.map((d) => (
            <div key={d} style={{
              padding: "5px 2px", textAlign: "center", borderRadius: 8, fontSize: 12,
              background: d === today ? T.brand : "none",
              color: d === today ? "#fff" : withSessions.includes(d) ? T.brand : T.dark,
              fontWeight: d === today || withSessions.includes(d) ? 600 : 400,
              position: "relative",
            }}>
              {d}
              {withSessions.includes(d) && d !== today && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.brand, position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)" }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.light, marginBottom: 8 }}>Ближайшие сессии</div>
        {[
          { date: "3 июля, чт", time: "11:00", client: "Анна Ковалёва", initials: "АК", color: "#7C9A6E" },
          { date: "7 июля, пн", time: "14:30", client: "Михаил Дронов", initials: "МД", color: "#7A8FC4" },
          { date: "10 июля, чт", time: "11:00", client: "Елена Морозова", initials: "ЕМ", color: "#C47A7A" },
        ].map((s) => (
          <div key={s.date} style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
            padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
          }}>
            <div style={{ textAlign: "center", minWidth: 36 }}>
              <div style={{ fontSize: 11, color: T.light }}>{s.date.split(",")[0]}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.brand }}>{s.time}</div>
            </div>
            <div style={{ width: 1, height: 30, background: T.border }} />
            <Av initials={s.initials} color={s.color} size={32} />
            <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{s.client}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoreScreen({ nav }: { nav: (s: Screen, opts?: Partial<NavEntry>) => void }) {
  const items = [
    { icon: <CreditCard size={18} />, label: "Платежи", screen: "payments" as Screen, color: T.green },
    { icon: <BarChart2 size={18} />, label: "Аналитика", screen: "analytics" as Screen, color: T.brand },
    { icon: <Brain size={18} />, label: "AI Чат", screen: "home" as Screen, color: "#9B8EC4" },
    { icon: <Mic size={18} />, label: "Голосовые заметки", screen: "home" as Screen, color: T.amber },
    { icon: <Settings size={18} />, label: "Настройки", screen: "settings" as Screen, color: T.light },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <MHeader title="Ещё" />
      <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item) => (
          <button key={item.label} onClick={() => nav(item.screen)} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 14px", background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color + "20", display: "flex", alignItems: "center", justifyContent: "center", color: item.color }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: T.dark }}>{item.label}</span>
            <ChevronRight size={16} color={T.muted} style={{ marginLeft: "auto" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentsScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Платежи" />
      <div style={{ padding: "14px 16px", background: T.card, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.light, marginBottom: 6 }}>Этот месяц</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.dark }}>4 500 MDL</div>
        <div style={{ fontSize: 12, color: T.green, marginTop: 2 }}>↑ 12% к прошлому месяцу</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.light, marginBottom: 2 }}>Транзакции</div>
        {[
          { client: "Анна Ковалёва",  initials: "АК", color: "#7C9A6E", amount: "900 MDL", date: "3 июл", type: "paid" },
          { client: "Михаил Дронов",  initials: "МД", color: "#7A8FC4", amount: "900 MDL", date: "1 июл", type: "paid" },
          { client: "Елена Морозова", initials: "ЕМ", color: "#C47A7A", amount: "900 MDL", date: "28 июн", type: "pending" },
          { client: "Анна Ковалёва",  initials: "АК", color: "#7C9A6E", amount: "900 MDL", date: "25 июн", type: "paid" },
        ].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            <Av initials={p.initials} color={p.color} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{p.client}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{p.date}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.dark }}>{p.amount}</div>
              <div style={{ marginTop: 2 }}>
                {p.type === "paid"
                  ? <Badge text="оплачено" bg={T.greenLt} color={T.green} />
                  : <Badge text="ожидает" bg={T.amberLt} color={T.amber} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Аналитика" />
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Всего клиентов", value: "4", sub: "+1 в этом месяце", color: "#7C9A6E" },
            { label: "Всего сессий", value: "28", sub: "6 в этом месяце", color: "#7A8FC4" },
            { label: "Доход за месяц", value: "4 500", sub: "MDL", color: T.green },
            { label: "Avg. сессий/клиент", value: "7", sub: "за всё время", color: "#9B8EC4" },
          ].map((k) => (
            <div key={k.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: T.light, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
        {/* Bar chart mock */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.dark, marginBottom: 12 }}>Сессий по месяцам</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {[3, 5, 4, 6, 8, 6, 6].map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", background: i === 6 ? T.brand : T.cardHov, borderRadius: 4, height: h * 10 }} />
                <div style={{ fontSize: 9, color: T.muted }}>
                  {["Янв","Фев","Мар","Апр","Май","Июн","Июл"][i]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MHeader title="Настройки" />
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}` }}>
            <Av initials="НП" color="#7C9A6E" size={48} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.dark }}>Наталья Петрова</div>
              <div style={{ fontSize: 12, color: T.light }}>Гештальт-терапевт</div>
            </div>
          </div>
          <button style={{ width: "100%", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 14, color: T.dark }}>Редактировать профиль</span>
            <ChevronRight size={16} color={T.muted} />
          </button>
        </div>
        {[
          { section: "Приложение", items: ["Telegram бот", "AI модель", "Язык"] },
          { section: "Данные", items: ["Экспорт данных", "Резервная копия"] },
          { section: "Прочее", items: ["О приложении", "Поддержка"] },
        ].map((s) => (
          <div key={s.section} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.light, marginBottom: 4, paddingLeft: 4 }}>{s.section}</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {s.items.map((item, i) => (
                <button key={item} style={{
                  width: "100%", padding: "12px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: i < s.items.length - 1 ? `1px solid ${T.border}` : "none",
                }}>
                  <span style={{ fontSize: 14, color: T.dark }}>{item}</span>
                  <ChevronRight size={14} color={T.muted} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bottom Navigation ──────────────────────────────────────────────────────────
function BottomNav({ active, nav }: { active: Screen; nav: (s: Screen) => void }) {
  const items = [
    { id: "home"          as Screen, icon: <Home size={20} />,        label: "Главная" },
    { id: "clients"       as Screen, icon: <Users size={20} />,       label: "Клиенты" },
    { id: "consultations" as Screen, icon: <FileText size={20} />,    label: "Сессии" },
    { id: "notebook"      as Screen, icon: <BookOpen size={20} />,    label: "Блокнот" },
    { id: "more"          as Screen, icon: <MoreHorizontal size={20}/>, label: "Ещё" },
  ];

  const rootScreen = (s: Screen) => {
    if (["client-detail","consultation-detail"].includes(s)) return false;
    return items.some((i) => i.id === s);
  };

  return (
    <div style={{
      display: "flex", borderTop: `1px solid ${T.border}`,
      background: T.bg, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {items.map((item) => {
        const isActive = active === item.id || (item.id === "more" && !rootScreen(active));
        return (
          <button key={item.id} onClick={() => nav(item.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            padding: "8px 4px 6px", background: "none", border: "none", cursor: "pointer",
            color: isActive ? T.brand : T.muted,
            gap: 2,
          }}>
            {item.icon}
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Phone Frame ────────────────────────────────────────────────────────────────
function PhoneFrame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const frameW = width + 24;
  const frameH = height + 80;
  return (
    <div style={{
      width: frameW, height: frameH, borderRadius: 50,
      background: "#1a1a1a", boxShadow: "0 40px 80px rgba(0,0,0,0.35), 0 0 0 1px #333",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 12px 16px", flexShrink: 0, position: "relative",
    }}>
      {/* notch */}
      <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 100, height: 28, background: "#000", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#333", marginRight: 8 }} />
        <div style={{ width: 50, height: 8, borderRadius: 4, background: "#222" }} />
      </div>
      {/* screen */}
      <div style={{ width, height, borderRadius: 30, overflow: "hidden", background: T.bg, display: "flex", flexDirection: "column" }}>
        {/* status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 6px", flexShrink: 0, background: T.bg }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.dark }}>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 1 }}>
              {[4,3,4,5].map((h, i) => <div key={i} style={{ width: 3, height: h, background: T.dark, borderRadius: 1 }} />)}
            </div>
            <div style={{ fontSize: 9, color: T.dark }}>WiFi</div>
            <div style={{ width: 20, height: 10, border: `1.5px solid ${T.dark}`, borderRadius: 2, position: "relative" }}>
              <div style={{ width: "70%", height: "100%", background: T.green, borderRadius: 1 }} />
              <div style={{ position: "absolute", right: -3, top: 2, width: 2, height: 6, background: T.dark, borderRadius: 1 }} />
            </div>
          </div>
        </div>
        {children}
      </div>
      {/* home indicator */}
      <div style={{ marginTop: 12, width: 120, height: 5, borderRadius: 3, background: "#555" }} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MobilePreviewPage() {
  const [deviceWidth, setDeviceWidth] = useState(390);
  const [navStack, setNavStack] = useState<NavEntry[]>([{ screen: "home" }]);
  const [showComparison, setShowComparison] = useState(false);

  const deviceHeight = Math.round(deviceWidth * 2.16);
  const current = navStack[navStack.length - 1];

  function navTo(screen: Screen, opts: Partial<NavEntry> = {}) {
    setNavStack((prev) => [...prev, { screen, ...opts }]);
  }

  function goBack() {
    if (navStack.length > 1) setNavStack((prev) => prev.slice(0, -1));
  }

  function navRoot(screen: Screen) {
    setNavStack([{ screen }]);
  }

  function renderScreen() {
    const { screen, id } = current;
    switch (screen) {
      case "home":          return <HomeScreen nav={navTo} />;
      case "clients":       return <ClientsScreen nav={navTo} />;
      case "client-detail": return <ClientDetailScreen id={id ?? "1"} goBack={goBack} nav={navTo} />;
      case "consultations": return <ConsultationsScreen nav={navTo} />;
      case "consultation-detail": return <ConsultationDetailScreen id={id ?? "1"} goBack={goBack} />;
      case "notebook":      return <NotebookScreen />;
      case "calendar":      return <CalendarScreen />;
      case "payments":      return <PaymentsScreen />;
      case "analytics":     return <AnalyticsScreen />;
      case "settings":      return <SettingsScreen />;
      case "more":          return <MoreScreen nav={navTo} />;
      default:              return <HomeScreen nav={navTo} />;
    }
  }

  const DEVICES = [
    { label: "SE", width: 320, desc: "iPhone SE" },
    { label: "360", width: 360, desc: "Android S" },
    { label: "390", width: 390, desc: "iPhone 15" },
    { label: "430", width: 430, desc: "iPhone 15+" },
  ];

  const SCREENS: { id: Screen; label: string }[] = [
    { id: "home", label: "Главная" },
    { id: "clients", label: "Клиенты" },
    { id: "client-detail", label: "Карточка" },
    { id: "consultations", label: "Консультации" },
    { id: "consultation-detail", label: "Сессия" },
    { id: "notebook", label: "Блокнот" },
    { id: "calendar", label: "Календарь" },
    { id: "payments", label: "Платежи" },
    { id: "analytics", label: "Аналитика" },
    { id: "settings", label: "Настройки" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Top toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "12px 24px",
        borderBottom: "1px solid #1e1e1e", background: "#111", flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a5ff8" }} />
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Mobile Preview</span>
          <span style={{ color: "#555", fontSize: 12 }}>TRANSCRIPT AI · PSY</span>
        </div>

        <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
          {DEVICES.map((d) => (
            <button key={d.width} onClick={() => setDeviceWidth(d.width)} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: deviceWidth === d.width ? "#3a5ff8" : "#1e1e1e",
              color: deviceWidth === d.width ? "#fff" : "#888",
              border: `1px solid ${deviceWidth === d.width ? "#3a5ff8" : "#2a2a2a"}`,
            }} title={d.desc}>
              {d.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowComparison((v) => !v)} style={{
          padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: showComparison ? "#7C9A6E20" : "#1e1e1e",
          color: showComparison ? "#7C9A6E" : "#888",
          border: `1px solid ${showComparison ? "#7C9A6E" : "#2a2a2a"}`,
          fontWeight: 500,
        }}>
          Сравнение
        </button>
      </div>

      {/* Screen selector */}
      <div style={{ display: "flex", gap: 4, padding: "10px 24px", overflowX: "auto", borderBottom: "1px solid #1e1e1e", background: "#111", flexShrink: 0 }}>
        {SCREENS.map((s) => (
          <button key={s.id} onClick={() => navRoot(s.id)} style={{
            flexShrink: 0, padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            background: current.screen === s.id || (current.screen === "client-detail" && s.id === "client-detail") || (current.screen === "consultation-detail" && s.id === "consultation-detail") ? "#1e2a50" : "#1a1a1a",
            color: current.screen === s.id ? "#a0b4ff" : "#666",
            border: `1px solid ${current.screen === s.id ? "#3a5ff8" : "#222"}`,
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px", gap: 60, overflowX: "auto" }}>
        {/* Phone */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ color: "#555", fontSize: 11 }}>{DEVICES.find((d) => d.width === deviceWidth)?.desc ?? `${deviceWidth}px`}</div>
          <PhoneFrame width={deviceWidth} height={deviceHeight}>
            {renderScreen()}
            <BottomNav active={current.screen} nav={navRoot} />
          </PhoneFrame>
          <div style={{ color: "#333", fontSize: 10 }}>{deviceWidth} × {deviceHeight} px</div>
        </div>

        {/* Desktop comparison */}
        {showComparison && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ color: "#555", fontSize: 11 }}>Desktop (1440px)</div>
            <div style={{
              width: 680, height: deviceHeight, borderRadius: 12, overflow: "hidden",
              border: "2px solid #2a2a2a", background: T.bg,
              display: "flex", flexDirection: "column",
            }}>
              {/* Desktop chrome */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#f0ede8", borderBottom: `1px solid ${T.border}` }}>
                {["#ff5f57","#febc2e","#28c840"].map((c) => (
                  <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
                ))}
                <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#888", border: `1px solid ${T.border}`, marginLeft: 8 }}>
                  transcript-ai-psy.railway.app
                </div>
              </div>
              {/* Desktop layout mock */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Sidebar */}
                <div style={{ width: 200, background: "#EFEBE4", borderRight: `1px solid ${T.border}`, padding: "16px 0", flexShrink: 0 }}>
                  <div style={{ padding: "0 16px 16px", borderBottom: `1px solid ${T.border}`, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.dark }}>PSY</div>
                  </div>
                  {["Главная","Клиенты","Консультации","Блокнот","Календарь","Платежи","Аналитика"].map((item, i) => (
                    <div key={item} style={{ padding: "6px 16px", fontSize: 12, color: i === 0 ? T.brand : T.mid, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? T.brandLt : "none", borderRadius: i === 0 ? "0 8px 8px 0" : 0, marginRight: 8 }}>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Content area */}
                <div style={{ flex: 1, background: T.bg, padding: "16px", overflow: "hidden" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.dark, marginBottom: 12 }}>
                    {SCREENS.find((s) => s.id === current.screen)?.label ?? "Главная"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[1,2,3,4].map((i) => (
                      <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", height: 56 }}>
                        <div style={{ width: "60%", height: 8, background: T.border, borderRadius: 4, marginBottom: 6 }} />
                        <div style={{ width: "80%", height: 6, background: T.border + "80", borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ color: "#333", fontSize: 10 }}>Схематичное представление десктопа</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 24px", borderTop: "1px solid #1a1a1a", background: "#0a0a0a", display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ color: "#333", fontSize: 11 }}>Этап 1 — интерактивный прототип</span>
        <span style={{ color: "#1e1e1e" }}>·</span>
        <span style={{ color: "#333", fontSize: 11 }}>Данные — мок, без подключения к БД</span>
        <span style={{ color: "#1e1e1e" }}>·</span>
        <span style={{ color: "#333", fontSize: 11 }}>Продакшн-страницы не изменены</span>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ color: "#3a5ff8", fontSize: 11 }}>После одобрения → Этап 2: реализация</span>
        </div>
      </div>
    </div>
  );
}
