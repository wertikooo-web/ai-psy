"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Inbox, MessageSquare, Mic, RefreshCw, Check, Trash2,
  User, ChevronDown, Clock, AlertCircle, Loader2, X,
  BookOpen,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  status: "new" | "processed" | "archived";
  messageType: "text" | "voice";
  text: string | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  initials: string;
  color: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  pageBg:   "#FBF8F5",
  card:     "#F3EBDD",
  border:   "#CFC0A9",
  borderLt: "#E5D9C8",
  text:     "#3D3228",
  muted:    "#7A6A52",
  faint:    "#9C8E80",
  header:   "#EDE5D8",
  blue:     "#3a5ff8",
  green:    "#16a34a",
  orange:   "#D97706",
  purple:   "#7C3AED",
};

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function itemsWord(n: number) {
  if (n % 100 >= 11 && n % 100 <= 14) return "сообщений";
  const r = n % 10;
  if (r === 1) return "сообщение";
  if (r >= 2 && r <= 4) return "сообщения";
  return "сообщений";
}

// ── Client picker ─────────────────────────────────────────────────────────────

function ClientPicker({
  clients,
  currentClientId,
  onSelect,
  onClose,
}: {
  clients: Client[];
  currentClientId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-xl flex flex-col"
        style={{ background: "#fff", border: `1px solid ${T.border}`, maxHeight: "70vh" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${T.borderLt}` }}>
          <span className="text-sm font-semibold" style={{ color: T.text }}>Выбрать клиента</span>
          <button onClick={onClose} style={{ color: T.faint }} className="rounded-lg p-1 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-3 py-2" style={{ borderBottom: `1px solid ${T.borderLt}` }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск клиента…"
            className="w-full text-sm px-3 py-1.5 rounded-lg outline-none"
            style={{ background: T.header, border: `1px solid ${T.borderLt}`, color: T.text }}
          />
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {currentClientId && (
            <button
              onClick={() => onSelect(null)}
              className="w-full text-left px-3 py-2 rounded-xl text-sm mb-1"
              style={{ color: T.orange }}
            >
              Убрать привязку к клиенту
            </button>
          )}
          {filtered.length === 0 && (
            <div className="text-center py-6 text-sm" style={{ color: T.faint }}>Клиенты не найдены</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-gray-50"
              style={{ background: c.id === currentClientId ? T.header : "transparent" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: c.color }}
              >
                {c.initials}
              </div>
              <span style={{ color: T.text }}>{c.name}</span>
              {c.id === currentClientId && <Check size={14} style={{ color: T.blue, marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  clients,
  onAction,
}: {
  item: InboxItem;
  clients: Client[];
  onAction: (id: string, action: "link" | "done" | "delete" | "note", payload?: unknown) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  async function handle(action: "link" | "done" | "delete" | "note", payload?: unknown) {
    setLoading(action);
    try {
      await onAction(item.id, action, payload);
      if (action === "note") setNoteSaved(true);
    } finally {
      setLoading(null);
      if (action === "link") setPickerOpen(false);
    }
  }

  const isVoice = item.messageType === "voice";

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: T.card, border: `1px solid ${T.border}` }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: T.header, border: `1px solid ${T.borderLt}` }}
          >
            {isVoice
              ? <Mic size={15} style={{ color: T.purple }} />
              : <MessageSquare size={15} style={{ color: T.blue }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: isVoice ? T.purple : T.blue }}>
                {isVoice ? "Голосовое" : "Текст"}
              </span>
              {item.clientName && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: T.header, color: T.muted, border: `1px solid ${T.borderLt}` }}
                >
                  {item.clientName}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: T.faint }}>
              <Clock size={10} />
              {fmtDate(item.createdAt)}
            </div>
          </div>
        </div>

        {/* Message text */}
        {item.text ? (
          <p
            className="text-sm leading-relaxed rounded-xl px-3 py-2.5"
            style={{ color: T.text, background: "#FAF6F1", border: `1px solid ${T.borderLt}` }}
          >
            {item.text}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: T.faint }}>Текст не записан</p>
        )}

        {/* Client bind */}
        <button
          onClick={() => setPickerOpen(true)}
          disabled={loading === "link"}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-colors w-full"
          style={{
            background: item.clientId ? T.header : "transparent",
            border: `1px solid ${T.borderLt}`,
            color: item.clientId ? T.text : T.faint,
          }}
        >
          <User size={13} style={{ flexShrink: 0 }} />
          <span className="flex-1 text-left truncate">
            {loading === "link" ? "Сохраняю…" : item.clientName ?? "Привязать к клиенту"}
          </span>
          <ChevronDown size={13} style={{ flexShrink: 0 }} />
        </button>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Save to notebook */}
          {item.text && (
            <button
              onClick={() => handle("note")}
              disabled={!!loading || noteSaved}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors"
              style={{
                background: noteSaved ? "#F0FDF4" : T.header,
                border: `1px solid ${noteSaved ? "#86EFAC" : T.borderLt}`,
                color: noteSaved ? T.green : T.muted,
                opacity: loading && loading !== "note" ? 0.5 : 1,
              }}
            >
              {loading === "note"
                ? <Loader2 size={13} className="animate-spin" />
                : <BookOpen size={13} />
              }
              {noteSaved ? "В блокноте" : "В блокнот"}
            </button>
          )}

          <div className="flex gap-2 ml-auto">
            {/* Mark processed */}
            <button
              onClick={() => handle("done")}
              disabled={!!loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors"
              style={{
                background: T.green,
                color: "#fff",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading === "done"
                ? <Loader2 size={13} className="animate-spin" />
                : <Check size={13} />
              }
              Обработано
            </button>

            {/* Delete */}
            <button
              onClick={() => handle("delete")}
              disabled={!!loading}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl transition-colors"
              style={{
                background: T.header,
                border: `1px solid ${T.borderLt}`,
                color: loading === "delete" ? T.faint : "#DC2626",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading === "delete"
                ? <Loader2 size={13} className="animate-spin" />
                : <Trash2 size={13} />
              }
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <ClientPicker
          clients={clients}
          currentClientId={item.clientId}
          onSelect={(clientId) => handle("link", { clientId })}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTERS = [
  { value: "new",       label: "Новые",        hint: "Необработанные сообщения — те, которые ещё требуют вашего внимания." },
  { value: "",          label: "Все",           hint: "Все сообщения: новые и обработанные. Удалённые не показываются." },
  { value: "processed", label: "Обработанные", hint: "Сообщения, которые вы пометили как обработанные." },
];

export default function TelegramInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("new");
  const filterRef = useRef(filterStatus);
  filterRef.current = filterStatus;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filterRef.current
        ? `/api/telegram-inbox?status=${encodeURIComponent(filterRef.current)}`
        : "/api/telegram-inbox";
      const [inboxRes, clientsRes] = await Promise.all([
        fetch(url),
        fetch("/api/clients"),
      ]);
      if (!inboxRes.ok) throw new Error("Ошибка загрузки");
      const inboxData = await inboxRes.json();
      const clientsData = clientsRes.ok ? await clientsRes.json() : [];
      setItems(inboxData.items ?? []);
      setTotal(inboxData.total ?? 0);
      setClients(
        (clientsData as { id: string; name: string; initials: string; color: string }[]).map((c) => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          color: c.color,
        }))
      );
    } catch {
      setError("Не удалось загрузить входящие");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, filterStatus]);

  async function handleAction(id: string, action: "link" | "done" | "delete" | "note", payload?: unknown) {
    if (action === "delete") {
      await fetch(`/api/telegram-inbox?id=${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => Math.max(0, t - 1));

    } else if (action === "done") {
      await fetch("/api/telegram-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "processed" }),
      });
      if (!filterRef.current || filterRef.current === "new") {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "processed" as const } : i));
      }

    } else if (action === "link") {
      const { clientId } = payload as { clientId: string | null };
      await fetch("/api/telegram-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, clientId }),
      });
      const clientName = clientId ? (clients.find((c) => c.id === clientId)?.name ?? null) : null;
      setItems((prev) =>
        prev.map((i) => i.id === id ? { ...i, clientId: clientId ?? null, clientName } : i)
      );

    } else if (action === "note") {
      const item = items.find((i) => i.id === id);
      if (!item?.text) return;
      await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text:     item.text,
          clientId: item.clientId ?? undefined,
          topic:    item.messageType === "voice" ? "Голосовое (Telegram)" : "Telegram",
          tags:     ["telegram"],
        }),
      });
    }
  }

  const newCount = items.filter((i) => i.status === "new").length;

  return (
    <div className="min-h-screen" style={{ background: T.pageBg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center gap-3"
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
      >
        <div className="relative">
          <Inbox size={20} style={{ color: T.muted }} />
          {newCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-white font-bold"
              style={{ background: T.blue, fontSize: 9 }}
            >
              {newCount > 9 ? "9+" : newCount}
            </span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold" style={{ color: T.text }}>Входящие из Telegram</h1>
          <p className="text-xs" style={{ color: T.faint }}>
            {loading
              ? "Загрузка…"
              : total === 0
              ? "Пусто — новые сообщения появятся здесь"
              : `${newCount > 0 ? `${newCount} новых · ` : ""}${total} ${itemsWord(total)}`
            }
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
          title="Обновить"
        >
          <RefreshCw
            size={15}
            style={{ color: T.muted, opacity: loading ? 0.4 : 1 }}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Explanation */}
        <div
          className="rounded-2xl px-4 py-3 mb-5 text-xs leading-relaxed"
          style={{ background: T.card, border: `1px solid ${T.borderLt}`, color: T.muted }}
        >
          Сюда попадают все <strong style={{ color: T.text }}>текстовые сообщения и голосовые вопросы</strong>, отправленные в Telegram-бот. Аудиофайлы консультаций обрабатываются прямо в Telegram.
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {FILTERS.map(({ value, label, hint }) => {
            const active = filterStatus === value;
            return (
              <div key={value} className="relative group">
                <button
                  onClick={() => setFilterStatus(value)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                  style={{
                    background: active ? T.blue : T.card,
                    color:      active ? "#fff" : T.muted,
                    border:     `1px solid ${active ? T.blue : T.borderLt}`,
                  }}
                >
                  {label}
                  {/* Info icon */}
                  <span
                    className="inline-flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 13, height: 13,
                      background: active ? "rgba(255,255,255,0.25)" : T.borderLt,
                      color: active ? "#fff" : T.faint,
                      fontSize: 8, fontWeight: 700, lineHeight: 1,
                    }}
                  >
                    i
                  </span>
                </button>
                {/* Tooltip */}
                <div
                  className="pointer-events-none absolute bottom-full left-0 mb-2 w-52 rounded-xl px-3 py-2 text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  style={{ background: T.text, color: "#F5EFE6", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}
                >
                  {hint}
                  <div
                    className="absolute top-full left-4"
                    style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${T.text}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-2xl p-4 text-sm flex items-center gap-2 mb-4"
            style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} style={{ color: T.blue }} className="animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: T.card, border: `1px solid ${T.border}` }}
            >
              <Inbox size={24} style={{ color: T.faint }} />
            </div>
            <p className="text-sm font-medium" style={{ color: T.text }}>Входящих нет</p>
            <p className="text-xs text-center max-w-xs" style={{ color: T.faint }}>
              Отправьте текст или голосовое сообщение в Telegram-бот — оно появится здесь
            </p>
          </div>
        )}

        {/* List */}
        {!loading && !error && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                clients={clients}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
