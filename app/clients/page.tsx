"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ArrowRight, Users,
  Pause, Archive, RotateCcw, CheckCircle2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AddClientModal } from "@/components/client/AddClientModal";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient, ClientStatus } from "@/lib/clientStore";

type AnyClient = StoredClient & { isMock?: boolean };
type FilterTab  = "active" | "paused" | "archived" | "all";
type ModalKind  = "delete" | "pause" | "archive" | "restore" | null;

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
  title: string; body: string; action: string; color: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}
function Confirm({ title, body, action, color, onConfirm, onCancel, loading }: ConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:bg-slate-200 ${color}`}>
            {loading ? "Подождите..." : action}
          </button>
        </div>
      </div>
    </div>
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
          opacity: client.isMock ? 0.35 : 1,
          pointerEvents: client.isMock ? "none" : "auto",
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

      {/* ── Top: avatar + name (фиксируем pr чтобы кнопки не перекрывали) ── */}
      <div className="p-5 pb-3 flex items-start gap-3">
        <Avatar initials={client.initials} color={client.color} size="lg" />
        <div className="min-w-0 flex-1 pr-20">
          <h2 className="font-semibold text-slate-800 truncate leading-tight">{client.name}</h2>
          {client.age && (
            <p className="text-xs text-stone-400 mt-0.5">{client.age} лет</p>
          )}
        </div>
      </div>

      {/* ── Middle: stats + concern + tags — flex-1 заполняет оставшееся ── */}
      <div className="px-5 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-2 text-xs text-stone-400">
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

        {client.concern && (
          <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed mb-2">{client.concern}</p>
        )}

        {/* Tags — максимум 2 строки */}
        <div className="flex flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: "3.2rem" }}>
          {client.mainTopics?.slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs text-stone-500 flex-shrink-0"
              style={{ background: "#E8E0D0", border: "1px solid #D8CFBE" }}>
              {t}
            </span>
          ))}
          {(client.mainTopics?.length ?? 0) > 4 && (
            <span className="px-2 py-0.5 rounded-full text-xs text-stone-400 flex-shrink-0">
              +{client.mainTopics.length - 4}
            </span>
          )}
        </div>
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
  const [addOpen, setAddOpen]             = useState(false);
  const [modal, setModal]                 = useState<ModalKind>(null);
  const [target, setTarget]               = useState<AnyClient | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadClients() {
    try {
      const res   = await fetch("/api/clients");
      const real: StoredClient[] = res.ok ? await res.json() : [];
      const realIds = new Set(real.map((c) => c.id));
      setClients([
        ...real,
        ...mockClients
          .filter((m) => !realIds.has(m.id))
          .map((m) => ({ ...m, isMock: true } as AnyClient)),
      ]);
    } catch {
      setClients(mockClients.map((m) => ({ ...m, isMock: true } as AnyClient)));
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
    if (!target || target.isMock) { setModal(null); return; }
    setActionLoading(true);
    try { await patchStatus(target.id, status); }
    finally { setActionLoading(false); setModal(null); setTarget(null); }
  }

  async function handleDelete() {
    if (!target || target.isMock) { setModal(null); return; }
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

  const filtered = clients.filter((c) => {
    if (filter === "all")      return true;
    if (filter === "active")   return c.status === "active";
    if (filter === "paused")   return c.status === "paused";
    if (filter === "archived") return c.status === "archived" || c.status === "completed";
    return true;
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "#F7F3EE" }}>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-800">Клиенты</h1>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} />
            Добавить клиента
          </button>
        </div>

        {/* Filter tabs with live counts */}
        <div className="flex gap-1.5 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.id
                  ? "bg-white text-slate-800 shadow-sm border border-stone-200"
                  : "text-stone-500 hover:text-slate-700 hover:bg-white/60"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${filter === f.id ? "text-slate-400" : "text-stone-400"}`}>
                {count[f.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border h-56 animate-pulse"
                style={{ background: CARD_BG, borderColor: "#DDD4C6" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-sm">
            {filter === "active"   && "Нет активных клиентов"}
            {filter === "paused"   && "Нет клиентов на паузе"}
            {filter === "archived" && "Архив пуст"}
            {filter === "all"      && "Клиентов пока нет"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpen={()    => router.push(`/client/${client.id}`)}
                onDelete={()  => openModal("delete", client)}
                onPause={()   => openModal("pause", client)}
                onArchive={()  => openModal("archive", client)}
                onRestore={()  => openModal("restore", client)}
              />
            ))}

            {filter === "active" && (
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
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={handleDelete}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
