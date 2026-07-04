"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Inbox, Mic, RefreshCw, Check, Trash2, User, ChevronDown,
  Clock, AlertCircle, Loader2, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  status: string;
  mimeType: string | null;
  durationSeconds: number | null;
  fileSize: number | null;
  originalFilename: string | null;
  clientId: string | null;
  clientName: string | null;
  consultationId: string | null;
  errorMessage: string | null;
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
  red:      "#DC2626",
};

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  received:              "Получено",
  awaiting_client:       "Ожидает клиента",
  awaiting_consultation: "Ожидает консультации",
  awaiting_confirmation: "Ожидает подтверждения",
  downloading:           "Загружается",
  uploading:             "Выгружается",
  queued:                "В очереди",
  processing:            "Обрабатывается",
  failed:                "Ошибка",
  expired:               "Истёк",
};

const STATUS_COLOR: Record<string, string> = {
  received:              "#6B7280",
  awaiting_client:       T.orange,
  awaiting_consultation: T.orange,
  awaiting_confirmation: T.blue,
  downloading:           T.blue,
  uploading:             T.blue,
  queued:                T.blue,
  processing:            T.blue,
  failed:                T.red,
  expired:               "#9CA3AF",
};

function statusLabel(s: string) { return STATUS_LABEL[s] ?? s; }
function statusColor(s: string) { return STATUS_COLOR[s] ?? T.muted; }

const ACTIVE_STATUSES = Object.keys(STATUS_LABEL);

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function typeLabel(mimeType: string | null) {
  if (!mimeType) return "Аудио";
  if (mimeType.startsWith("audio/ogg")) return "Голосовое";
  if (mimeType.startsWith("audio/")) return "Аудио";
  if (mimeType.startsWith("video/")) return "Видео";
  return "Файл";
}

// ── Client picker modal ───────────────────────────────────────────────────────

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
              className="w-full text-left px-3 py-2 rounded-xl text-sm mb-1 hover:bg-gray-50"
              style={{ color: T.red }}
            >
              Убрать привязку
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
  onAction: (id: string, action: "link" | "done" | "delete", payload?: unknown) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(action: "link" | "done" | "delete", payload?: unknown) {
    setLoading(action);
    try {
      await onAction(item.id, action, payload);
    } finally {
      setLoading(null);
      if (action === "link") setPickerOpen(false);
    }
  }

  const isProcessing = ["downloading", "uploading", "queued", "processing"].includes(item.status);

  return (
    <>
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: T.card, border: `1px solid ${T.border}` }}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: T.header, border: `1px solid ${T.borderLt}` }}
          >
            {isProcessing
              ? <Loader2 size={18} style={{ color: T.blue }} className="animate-spin" />
              : item.status === "failed"
              ? <AlertCircle size={18} style={{ color: T.red }} />
              : <Mic size={18} style={{ color: T.muted }} />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: T.text }}>
                {typeLabel(item.mimeType)}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${statusColor(item.status)}18`, color: statusColor(item.status) }}
              >
                {statusLabel(item.status)}
              </span>
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: T.faint }}>
              <span className="flex items-center gap-1"><Clock size={11} />{fmtDate(item.createdAt)}</span>
              {item.durationSeconds && <span>{fmtDuration(item.durationSeconds)}</span>}
              {item.fileSize && <span>{fmtSize(item.fileSize)}</span>}
            </div>
          </div>
        </div>

        {/* Error message */}
        {item.status === "failed" && item.errorMessage && (
          <div
            className="text-xs rounded-xl px-3 py-2"
            style={{ background: "#FEF2F2", color: T.red, border: "1px solid #FECACA" }}
          >
            {item.errorMessage}
          </div>
        )}

        {/* Client row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            disabled={loading === "link"}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-colors flex-1 min-w-0"
            style={{
              background: item.clientId ? T.header : "transparent",
              border: `1px solid ${T.borderLt}`,
              color: item.clientId ? T.text : T.faint,
            }}
          >
            <User size={13} style={{ flexShrink: 0 }} />
            <span className="truncate">
              {loading === "link"
                ? "Сохраняю…"
                : item.clientName ?? "Привязать клиента"}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0, marginLeft: "auto" }} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handle("done")}
            disabled={!!loading || isProcessing}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition-colors flex-1 justify-center"
            style={{
              background: T.green,
              color: "#fff",
              opacity: loading || isProcessing ? 0.5 : 1,
            }}
          >
            {loading === "done"
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} />
            }
            Обработано
          </button>

          <button
            onClick={() => handle("delete")}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition-colors"
            style={{
              background: T.header,
              border: `1px solid ${T.borderLt}`,
              color: loading === "delete" ? T.faint : T.red,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading === "delete"
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} />
            }
          </button>
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

export default function TelegramInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
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

  async function handleAction(id: string, action: "link" | "done" | "delete", payload?: unknown) {
    if (action === "delete") {
      await fetch(`/api/telegram-inbox?id=${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => t - 1);
    } else if (action === "done") {
      const res = await fetch("/api/telegram-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "completed" }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setTotal((t) => t - 1);
      }
    } else if (action === "link") {
      const { clientId } = payload as { clientId: string | null };
      const res = await fetch("/api/telegram-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, clientId }),
      });
      if (res.ok) {
        const clientName = clientId ? (clients.find((c) => c.id === clientId)?.name ?? null) : null;
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, clientId: clientId ?? null, clientName } : i))
        );
      }
    }
  }

  return (
    <div className="min-h-screen" style={{ background: T.pageBg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center gap-3"
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
      >
        <Inbox size={20} style={{ color: T.muted }} />
        <div className="flex-1">
          <h1 className="text-base font-bold" style={{ color: T.text }}>Входящие из Telegram</h1>
          <p className="text-xs" style={{ color: T.faint }}>
            {loading ? "Загрузка…" : `${total} ${itemsWord(total)} ожидают обработки`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
          title="Обновить"
        >
          <RefreshCw size={15} style={{ color: T.muted, opacity: loading ? 0.4 : 1 }} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[{ value: "", label: "Все" }, ...ACTIVE_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={{
                background: filterStatus === value ? T.blue : T.card,
                color: filterStatus === value ? "#fff" : T.muted,
                border: `1px solid ${filterStatus === value ? T.blue : T.borderLt}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* States */}
        {error && (
          <div className="rounded-2xl p-4 text-sm flex items-center gap-2" style={{ background: "#FEF2F2", color: T.red, border: "1px solid #FECACA" }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} style={{ color: T.blue }} className="animate-spin" />
          </div>
        )}

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
              Все голосовые сообщения из Telegram будут появляться здесь для обработки
            </p>
          </div>
        )}

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

function itemsWord(n: number) {
  if (n % 100 >= 11 && n % 100 <= 14) return "записей";
  const r = n % 10;
  if (r === 1) return "запись";
  if (r >= 2 && r <= 4) return "записи";
  return "записей";
}
