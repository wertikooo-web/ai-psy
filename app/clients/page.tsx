"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, Users, Pause, Archive, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AddClientModal } from "@/components/client/AddClientModal";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient, ClientStatus } from "@/lib/clientStore";

type AnyClient = StoredClient & { isMock?: boolean };
type FilterTab  = "active" | "paused" | "archived" | "all";
type ModalKind  = "delete" | "pause" | "archive" | null;

// ── Palette ───────────────────────────────────────────────────────────────────
const CARD_BG    = "#F0EBE1";
const CARD_MUTED = "#EAE2D6";        // paused / archived card tint
const TAB_BG     = "#C9BBAA";        // folder-tab: noticeably darker than card
const TAB_HOVER  = "#BEB09E";        // folder-tab hover

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active:    "активный",
  paused:    "пауза",
  archived:  "архив",
  completed: "завершён",
};
const STATUS_COLOR: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border border-emerald-100",
  paused:    "bg-amber-50 text-amber-700 border border-amber-100",
  archived:  "bg-stone-100 text-stone-500 border border-stone-200",
  completed: "bg-stone-100 text-stone-500 border border-stone-200",
};

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
  { id: "paused",   label: "Пауза" },
  { id: "archived", label: "Архив" },
  { id: "all",      label: "Все" },
];

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
  const isInactive = client.status === "paused" || client.status === "archived" || client.status === "completed";
  const [hovered, setHovered] = useState(false);

  return (
    // NO overflow:hidden — tooltips must not be clipped
    // folder-tab gets rounded-b-2xl explicitly instead
    <div
      className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{
        background:  isInactive ? CARD_MUTED : CARD_BG,
        borderColor: "#DDD4C6",
        opacity:     isInactive ? 0.87 : 1,
      }}
    >
      {/* ── Top: avatar + name + 3 action buttons ── */}
      <div className="p-5 pb-3 flex items-start gap-3">
        <Avatar initials={client.initials} color={client.color} size="lg" />

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-800 truncate leading-tight">{client.name}</h2>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[client.status]}`}>
            {STATUS_LABEL[client.status]}
          </span>
        </div>

        {/* All 3 actions — top right, always visible */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isInactive ? (
            <>
              <Tip text="Временно приостановить работу с клиентом">
                <button
                  onClick={(e) => { e.stopPropagation(); onPause(); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                >
                  <Pause size={13} />
                </button>
              </Tip>
              <Tip text="Переместить клиента в архив">
                <button
                  onClick={(e) => { e.stopPropagation(); onArchive(); }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-slate-600 hover:bg-stone-200 transition-colors"
                >
                  <Archive size={13} />
                </button>
              </Tip>
            </>
          ) : (
            <Tip text="Вернуть клиента в активные">
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(); }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            </Tip>
          )}
          <Tip text="Удалить клиента и все связанные данные">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </Tip>
        </div>
      </div>

      {/* ── Body: stats + concern + tags ── */}
      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center gap-3 mb-2.5 text-xs text-stone-400">
          {client.age && <span>{client.age} лет</span>}
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
          <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">{client.concern}</p>
        )}

        {client.mainTopics?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {client.mainTopics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-xs text-stone-500"
                style={{ background: "#E8E0D0", border: "1px solid #D8CFBE" }}
              >
                {t}
              </span>
            ))}
            {client.mainTopics.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-xs text-stone-400">
                +{client.mainTopics.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Folder tab: full-width CTA ── */}
      {/*
        Looks like a paper folder tab:
        - flat top edge (border-radius: 0) — card's overflow:hidden gives us rounded bottom
        - visible border-top separates tab from body
        - inset top highlight simulates paper catching light
        - box-shadow gives slight lift/depth
      */}
      <button
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-all group rounded-b-2xl"
        style={{
          background:  hovered ? TAB_HOVER : TAB_BG,
          color:       "#4A3F32",
          borderTop:   "1px solid #B8AC9A",
          boxShadow:   "inset 0 1px 0 rgba(255,255,255,0.22)",
          transition:  "background 0.15s ease",
        }}
      >
        <span className="tracking-wide">Открыть карточку</span>
        <ArrowRight
          size={14}
          className="text-stone-500 transition-transform duration-150"
          style={{ transform: hovered ? "translateX(3px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients]           = useState<AnyClient[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<FilterTab>("active");
  const [addOpen, setAddOpen]           = useState(false);
  const [modal, setModal]               = useState<ModalKind>(null);
  const [target, setTarget]             = useState<AnyClient | null>(null);
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

  function open(kind: ModalKind, client: AnyClient) {
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

  async function handleStatusChange(status: ClientStatus) {
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

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6">
          {FILTERS.map((f) => {
            const count =
              f.id === "all"      ? clients.length :
              f.id === "archived" ? clients.filter((c) => c.status === "archived" || c.status === "completed").length :
                                    clients.filter((c) => c.status === f.id).length;
            return (
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
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border h-56 animate-pulse" style={{ background: CARD_BG, borderColor: "#E2D9CC" }} />
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
                onDelete={()  => open("delete", client)}
                onPause={()   => open("pause", client)}
                onArchive={()  => open("archive", client)}
                onRestore={async () => {
                  if (client.isMock) return;
                  setActionLoading(true);
                  try { await patchStatus(client.id, "active"); }
                  finally { setActionLoading(false); }
                }}
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

      {modal === "delete" && target && (
        <Confirm
          title={`Удалить клиента ${target.name}?`}
          body="Будут удалены клиент, его консультации, история и материалы. Это действие нельзя отменить."
          action="Удалить"
          color="bg-rose-500 hover:bg-rose-600"
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={handleDelete}
          loading={actionLoading}
        />
      )}
      {modal === "pause" && target && (
        <Confirm
          title={`Перевести ${target.name} в паузу?`}
          body="Клиент останется в системе, но будет отображаться в разделе «Пауза». Консультации, материалы и история сохранятся."
          action="Перевести в паузу"
          color="bg-amber-500 hover:bg-amber-600"
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={() => handleStatusChange("paused")}
          loading={actionLoading}
        />
      )}
      {modal === "archive" && target && (
        <Confirm
          title={`Переместить ${target.name} в архив?`}
          body="Клиент исчезнет из активного списка. Консультации, материалы, история и анализы сохранятся."
          action="Переместить в архив"
          color="bg-slate-600 hover:bg-slate-700"
          onCancel={() => { setModal(null); setTarget(null); }}
          onConfirm={() => handleStatusChange("archived")}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
