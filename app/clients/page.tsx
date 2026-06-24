"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ui/ModalPortal";
import {
  Plus, Trash2, ArrowRight, ArrowLeft, Users,
  Pause, Archive, RotateCcw, CheckCircle2,
  Search, ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AddClientModal } from "@/components/client/AddClientModal";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient, ClientStatus } from "@/lib/clientStore";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type AnyClient   = StoredClient & { isMock?: boolean };
type FilterTab   = "active" | "paused" | "archived" | "all";
type ModalKind   = "delete" | "pause" | "archive" | "restore" | null;
type SortOption  = "lastSession" | "name" | "sessions";
type GroupOption = "none" | "topic" | "status";

// ── Palette ───────────────────────────────────────────────────────────────────
const CARD_BG  = "#F0EBE1";
const TAB_BG   = "#C9BBAA";
const TAB_HOV  = "#BEB09E";

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_BADGE = {
  active: {
    bg:      "#D1FAE5",
    ring:    "#6EE7B7",
    icon:    CheckCircle2,
    color:   "#059669",
    tip:     "Клиент активен",
  },
  paused: {
    bg:      "#FEF3C7",
    ring:    "#FCD34D",
    icon:    Pause,
    color:   "#D97706",
    tip:     "Клиент на паузе: работа временно приостановлена, но может быть продолжена",
  },
  archived: {
    bg:      "#E7E5E4",
    ring:    "#D6D3D1",
    icon:    Archive,
    color:   "#78716C",
    tip:     "Клиент в архиве: случай закрыт или завершён, данные сохранены",
  },
  completed: {
    bg:      "#E7E5E4",
    ring:    "#D6D3D1",
    icon:    Archive,
    color:   "#78716C",
    tip:     "Клиент завершён",
  },
} as const;

// ── Action button (26px, dark icon, hover bg) ─────────────────────────────────
function ActionBtn({ onClick, hoverColor, hoverBg, children }: {
  onClick: (e: React.MouseEvent) => void;
  hoverColor: string;
  hoverBg: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0"
      style={{ color: "#6B5D4F", background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = hoverColor; e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full right-0 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 w-max max-w-[200px] text-center leading-snug shadow-lg">
        {text}
      </div>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
interface ConfirmProps {
  title: string; body: string; action: string; color: string; isMock?: boolean;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}
function Confirm({ title, body, action, color, isMock, onConfirm, onCancel, loading }: ConfirmProps) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-2">{title}</h2>
          {isMock ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-6 leading-relaxed">
              Это демо-клиент. Создайте реального клиента через «Добавить клиента», чтобы управлять статусами.
            </p>
          ) : (
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{body}</p>
          )}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              {isMock ? "Закрыть" : "Отмена"}
            </button>
            {!isMock && (
              <button onClick={onConfirm} disabled={loading} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:bg-slate-200 ${color}`}>
                {loading ? "Подождите..." : action}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "active",   label: "Активные" },
  { id: "paused",   label: "Пауза"    },
  { id: "archived", label: "Архив"    },
  { id: "all",      label: "Все"      },
];

// ── Small status badge (26 px) ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[(status ?? "active") as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.active;
  const Icon = cfg.icon;
  return (
    <Tip text={cfg.tip}>
      <div
        className="flex items-center justify-center flex-shrink-0 cursor-default rounded-full"
        style={{
          width: 26, height: 26,
          background: cfg.bg,
          border: `1.5px solid ${cfg.ring}`,
        }}
      >
        <Icon size={13} style={{ color: cfg.color }} />
      </div>
    </Tip>
  );
}

// ── Client card ───────────────────────────────────────────────────────────────
interface CardProps {
  client:    AnyClient;
  onOpen:    () => void;
  onDelete:  () => void;
  onPause:   () => void;
  onArchive: () => void;
  onRestore: () => void;
}

function ClientCard({ client, onOpen, onDelete, onPause, onArchive, onRestore }: CardProps) {
  const [tabHov, setTabHov] = useState(false);
  const status = (client.status ?? "active") as keyof typeof STATUS_BADGE;


  return (
    <div
      className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{ background: CARD_BG, borderColor: "#DDD4C6", minHeight: 292, position: "relative" }}
    >
      {/* ── Action buttons: белая пилюля, всегда в правом верхнем углу ── */}
      <div
        className="absolute flex items-center gap-0.5 rounded-lg px-1 py-0.5"
        style={{
          top: 10, right: 10, zIndex: 20,
          background: "#FFFFFF",
          border: "1px solid #D8CFBE",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {status === "active" && (
          <Tip text="Перевести клиента в паузу">
            <ActionBtn onClick={(e) => { e.stopPropagation(); onPause(); }} hoverColor="#D97706" hoverBg="#FEF3C7">
              <Pause size={15} />
            </ActionBtn>
          </Tip>
        )}
        {(status === "paused" || status === "archived" || status === "completed") && (
          <Tip text="Вернуть клиента в активные">
            <ActionBtn onClick={(e) => { e.stopPropagation(); onRestore(); }} hoverColor="#059669" hoverBg="#D1FAE5">
              <RotateCcw size={15} />
            </ActionBtn>
          </Tip>
        )}
        {(status === "active" || status === "paused") && (
          <Tip text="Переместить клиента в архив">
            <ActionBtn onClick={(e) => { e.stopPropagation(); onArchive(); }} hoverColor="#57534E" hoverBg="#E7E5E4">
              <Archive size={15} />
            </ActionBtn>
          </Tip>
        )}
        <Tip text="Удалить клиента">
          <ActionBtn onClick={(e) => { e.stopPropagation(); onDelete(); }} hoverColor="#EF4444" hoverBg="#FEE2E2">
            <Trash2 size={15} />
          </ActionBtn>
        </Tip>
      </div>

      {/* ── 1. Имя + возраст ── */}
      <div className="p-5 pb-3 flex items-start gap-3">
        <Avatar initials={client.initials} color={client.color} size="lg" />
        <div className="min-w-0 flex-1 pr-20">
          <h2 className="font-semibold text-slate-800 truncate leading-tight">{client.name}</h2>
          {client.age && (
            <p className="text-xs mt-0.5" style={{ color: "#A8997F" }}>{client.age} лет</p>
          )}
        </div>
      </div>

      {/* ── 2. Встречи + дата ── */}
      <div className="px-5 pb-2 flex items-center gap-3 text-xs" style={{ color: "#A8997F" }}>
        <div className="flex items-center gap-1">
          <Users size={11} />
          <span>{client.totalConsultations} встреч</span>
        </div>
        {client.lastConsultation && (
          <span>
            {new Date(client.lastConsultation).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {/* ── 3. Основной запрос ── */}
      <div className="px-5 flex-1 flex flex-col gap-3">
        {client.concern ? (
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "#4A3C2E" }}>
            {client.concern}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: "#C9BBAA" }}>Запрос не указан</p>
        )}

        {/* ── 4. Темы (теги) ── */}
        {(client.mainTopics?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {client.mainTopics.slice(0, 5).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-xs flex-shrink-0"
                style={{ background: "#E8E0D0", border: "1px solid #D8CFBE", color: "#6B5D4F" }}
              >
                {t}
              </span>
            ))}
            {client.mainTopics.length > 5 && (
              <span className="px-2 py-0.5 rounded-full text-xs flex-shrink-0" style={{ color: "#A8997F" }}>
                +{client.mainTopics.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom: status badge закреплён над кнопкой ── */}
      <div className="px-5 py-3 flex justify-end">
        <StatusBadge status={client.status} />
      </div>

      {/* ── Folder-tab CTA — всегда внизу ── */}
      <button
        onClick={onOpen}
        onMouseEnter={() => setTabHov(true)}
        onMouseLeave={() => setTabHov(false)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium rounded-b-2xl"
        style={{
          background:   tabHov ? TAB_HOV : TAB_BG,
          color:        "#4A3F32",
          borderTop:    "1px solid #B8AC9A",
          boxShadow:    "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition:   "background 0.15s ease",
        }}
      >
        <span>Открыть карточку</span>
        <ArrowRight size={14} className="text-stone-500 transition-transform duration-150"
          style={{ transform: tabHov ? "translateX(3px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients]             = useState<AnyClient[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState<FilterTab>("active");
  const [search, setSearch]               = useState("");
  const [sort, setSort]                   = useState<SortOption>("lastSession");
  const [group, setGroup]                 = useState<GroupOption>("none");
  const [addOpen, setAddOpen]             = useState(false);
  const [modal, setModal]                 = useState<ModalKind>(null);
  const [target, setTarget]               = useState<AnyClient | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadClients() {
    try {
      const res  = await fetch("/api/clients");
      const real: StoredClient[] = res.ok ? await res.json() : [];

      if (DEMO_MODE) {
        // In demo mode: show real data + mock data for any missing mock IDs
        const realIds = new Set(real.map((c) => c.id));
        setClients([
          ...real,
          ...mockClients
            .filter((m) => !realIds.has(m.id))
            .map((m) => ({ ...m, isMock: true } as AnyClient)),
        ]);
      } else {
        // Production: only real data, no mock fallback
        setClients(real);
      }
    } catch {
      if (DEMO_MODE) {
        setClients(mockClients.map((m) => ({ ...m, isMock: true } as AnyClient)));
      } else {
        setClients([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  function openModal(kind: ModalKind, client: AnyClient) {
    setTarget(client);
    setModal(kind);
  }

  async function patchStatus(id: string, status: ClientStatus) {
    await fetch(`/api/clients/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    await loadClients();
  }

  async function handleConfirmedStatus(status: ClientStatus) {
    if (!target) { setModal(null); return; }
    if (target.isMock) {
      setModal(null);
      setTarget(null);
      return;
    }
    setActionLoading(true);
    try { await patchStatus(target.id, status); }
    finally { setActionLoading(false); setModal(null); setTarget(null); }
  }

  async function handleDelete() {
    if (!target) { setModal(null); return; }
    if (target.isMock) {
      setModal(null);
      setTarget(null);
      return;
    }
    setActionLoading(true);
    try {
      await fetch(`/api/clients/${target.id}`, { method: "DELETE" });
      await loadClients();
    } finally { setActionLoading(false); setModal(null); setTarget(null); }
  }

  // Counts for tab badges
  const count = {
    active:   clients.filter((c) => c.status === "active").length,
    paused:   clients.filter((c) => c.status === "paused").length,
    archived: clients.filter((c) => c.status === "archived" || c.status === "completed").length,
    all:      clients.length,
  };

  // 1. Filter by status
  // 2. Filter by search (name, concern, tags)
  // 3. Sort
  // 4. Group
  const processed = useMemo(() => {
    const q = search.trim().toLowerCase();

    const afterStatus = clients.filter((c) => {
      if (filter === "active")   return c.status === "active";
      if (filter === "paused")   return c.status === "paused";
      if (filter === "archived") return c.status === "archived" || c.status === "completed";
      return true;
    });

    const afterSearch = q
      ? afterStatus.filter((c) => {
          const inName    = c.name.toLowerCase().includes(q);
          const inConcern = (c.concern ?? "").toLowerCase().includes(q);
          const inTags    = (c.mainTopics ?? []).some((t) => t.toLowerCase().includes(q));
          return inName || inConcern || inTags;
        })
      : afterStatus;

    const sorted = [...afterSearch].sort((a, b) => {
      if (sort === "name")       return a.name.localeCompare(b.name, "ru");
      if (sort === "sessions")   return (b.totalConsultations ?? 0) - (a.totalConsultations ?? 0);
      // lastSession — recent first, missing last
      const da = a.lastConsultation ? new Date(a.lastConsultation).getTime() : 0;
      const db = b.lastConsultation ? new Date(b.lastConsultation).getTime() : 0;
      return db - da;
    });

    return sorted;
  }, [clients, filter, search, sort]);

  // Grouping
  const STATUS_LABEL: Record<string, string> = {
    active: "Активные", paused: "Пауза", archived: "Архив", completed: "Архив",
  };

  const grouped = useMemo((): { label: string; clients: AnyClient[] }[] => {
    if (group === "none") return [{ label: "", clients: processed }];

    if (group === "status") {
      const order = ["active", "paused", "archived"];
      const map = new Map<string, AnyClient[]>();
      for (const c of processed) {
        const key = c.status === "completed" ? "archived" : (c.status ?? "active");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
      return order
        .filter((k) => map.has(k))
        .map((k) => ({ label: STATUS_LABEL[k], clients: map.get(k)! }));
    }

    // group by first tag (mainTopics[0])
    const map = new Map<string, AnyClient[]>();
    for (const c of processed) {
      const key = c.mainTopics?.[0] ?? "Без темы";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a === "Без темы" ? 1 : b === "Без темы" ? -1 : a.localeCompare(b, "ru"))
      .map(([label, clients]) => ({ label, clients }));
  }, [processed, group]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
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
            <h1 className="text-xl font-bold text-slate-800">Клиенты</h1>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} />
            Добавить клиента
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, запросу или теме..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: "#FFFFFF",
              border: "1px solid #D8CFBE",
              color: "#3A2E22",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#A8997F"; }}
            onBlur={(e)  => { e.target.style.borderColor = "#D8CFBE"; }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#A8997F" }}
            >
              <ChevronDown size={14} style={{ transform: "rotate(0)" }} />
            </button>
          )}
        </div>

        {/* Status tabs + Sort + Group */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Status tabs */}
          <div className="flex gap-1 flex-1 min-w-0">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex-shrink-0"
                style={{
                  background: filter === f.id ? "#FFFFFF" : "transparent",
                  color:      filter === f.id ? "#3A2E22" : "#7A6E60",
                  border:     filter === f.id ? "1px solid #D8CFBE" : "1px solid transparent",
                  boxShadow:  filter === f.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {f.label}
                <span className="ml-1.5 text-xs" style={{ color: filter === f.id ? "#A8997F" : "#B8AC9A" }}>
                  {count[f.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs" style={{ color: "#A8997F" }}>Сортировать:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="text-xs pl-2.5 pr-6 py-1.5 rounded-xl outline-none appearance-none cursor-pointer"
              style={{
                background: "#F0EBE1",
                border: "1px solid #D8CFBE",
                color: "#4A3C2E",
              }}
            >
              <option value="lastSession">Последняя встреча</option>
              <option value="name">Имя А-Я</option>
              <option value="sessions">Кол-во встреч</option>
            </select>
          </div>

          {/* Group dropdown */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs" style={{ color: "#A8997F" }}>Группировать:</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupOption)}
              className="text-xs pl-2.5 pr-6 py-1.5 rounded-xl outline-none appearance-none cursor-pointer"
              style={{
                background: "#F0EBE1",
                border: "1px solid #D8CFBE",
                color: "#4A3C2E",
              }}
            >
              <option value="none">Без группировки</option>
              <option value="topic">По основной теме</option>
              <option value="status">По статусу</option>
            </select>
          </div>
        </div>

        {/* Grid / Groups */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border h-56 animate-pulse"
                style={{ background: CARD_BG, borderColor: "#DDD4C6" }} />
            ))}
          </div>
        ) : processed.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#E8E0D0" }}>
              <Users size={26} style={{ color: "#A8997F" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium" style={{ color: "#6B5D4F" }}>
                {search
                  ? `По запросу «${search}» ничего не найдено`
                  : clients.length === 0 && !DEMO_MODE && filter === "active"
                    ? "Клиентов пока нет"
                    : filter === "active"   ? "Нет активных клиентов"
                    : filter === "paused"   ? "Нет клиентов на паузе"
                    : filter === "archived" ? "Архив пуст"
                    : "Клиентов пока нет"}
              </p>
              {clients.length === 0 && !DEMO_MODE && !search && filter === "active" && (
                <p className="text-xs" style={{ color: "#A8997F" }}>
                  Добавьте первого клиента, чтобы начать работу
                </p>
              )}
            </div>
            {!search && filter === "active" && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
              >
                <Plus size={15} />
                Добавить клиента
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ label, clients: groupClients }) => (
              <div key={label || "_all"}>
                {label && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>
                      {label}
                    </span>
                    <span className="text-xs" style={{ color: "#C9BBAA" }}>{groupClients.length}</span>
                    <div className="flex-1 h-px" style={{ background: "#E5DDD2" }} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {groupClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      onOpen={()     => router.push(`/client/${client.id}`)}
                      onDelete={()   => openModal("delete", client)}
                      onPause={()    => openModal("pause", client)}
                      onArchive={()  => openModal("archive", client)}
                      onRestore={()  => openModal("restore", client)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Add client placeholder — only in no-group active view */}
            {group === "none" && filter === "active" && !search && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <button
                  onClick={() => setAddOpen(true)}
                  className="rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 text-stone-400 hover:text-brand-500 hover:border-brand-300 hover:bg-brand-50/30 transition-all min-h-[220px]"
                  style={{ borderColor: "#D8CFBE" }}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#E8E0D0" }}>
                    <Plus size={20} />
                  </div>
                  <span className="text-sm font-medium">Добавить клиента</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); loadClients(); }}
      />

      {/* ── Confirm modals ── */}
      {modal === "pause" && target && (
        <Confirm
          title={`Перевести ${target.name} в паузу?`}
          body="Клиент останется в системе. Все консультации, материалы и история сохранятся."
          action="Перевести в паузу"
          color="bg-amber-500 hover:bg-amber-600"
          isMock={!!target.isMock}
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={() => handleConfirmedStatus("paused")}
          loading={actionLoading}
        />
      )}
      {modal === "archive" && target && (
        <Confirm
          title={`Переместить ${target.name} в архив?`}
          body="Клиент исчезнет из активных клиентов, но все консультации, материалы и история сохранятся."
          action="Переместить в архив"
          color="bg-stone-600 hover:bg-stone-700"
          isMock={!!target.isMock}
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={() => handleConfirmedStatus("archived")}
          loading={actionLoading}
        />
      )}
      {modal === "restore" && target && (
        <Confirm
          title={`Вернуть ${target.name} в активные?`}
          body="Клиент снова появится в списке активных клиентов."
          action="Вернуть в активные"
          color="bg-emerald-500 hover:bg-emerald-600"
          isMock={!!target.isMock}
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={() => handleConfirmedStatus("active")}
          loading={actionLoading}
        />
      )}
      {modal === "delete" && target && (
        <Confirm
          title={`Удалить клиента ${target.name}?`}
          body="Будут удалены клиент, консультации, материалы и история. Это действие нельзя отменить."
          action="Удалить"
          color="bg-rose-500 hover:bg-rose-600"
          isMock={!!target.isMock}
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={handleDelete}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
