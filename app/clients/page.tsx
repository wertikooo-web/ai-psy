"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, Users, Pause, Archive } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AddClientModal } from "@/components/client/AddClientModal";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";
import type { ClientStatus } from "@/lib/clientStore";

type AnyClient = StoredClient & { isMock?: boolean };
type FilterTab = "active" | "paused" | "archived" | "all";

// ── Status display ────────────────────────────────────────────────────────────

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

// ── Tooltip wrapper ───────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-20 max-w-[220px] text-center leading-tight">
        {text}
      </div>
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

interface ConfirmModal {
  title:   string;
  body:    string;
  action:  string;
  color:   string;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
}

function Confirm({ title, body, action, color, onConfirm, onCancel, loading }: ConfirmModal) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:bg-slate-200 ${color}`}
          >
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients]     = useState<AnyClient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterTab>("active");
  const [addOpen, setAddOpen]     = useState(false);

  // confirm states
  type ModalKind = "delete" | "pause" | "archive" | null;
  const [modal, setModal]         = useState<ModalKind>(null);
  const [target, setTarget]       = useState<AnyClient | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadClients() {
    try {
      const res  = await fetch("/api/clients");
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

  async function handleStatusChange(status: ClientStatus) {
    if (!target || target.isMock) { setModal(null); return; }
    setActionLoading(true);
    try {
      await fetch(`/api/clients/${target.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      await loadClients();
    } finally {
      setActionLoading(false);
      setModal(null);
      setTarget(null);
    }
  }

  async function handleDelete() {
    if (!target || target.isMock) { setModal(null); return; }
    setActionLoading(true);
    try {
      await fetch(`/api/clients/${target.id}`, { method: "DELETE" });
      await loadClients();
    } finally {
      setActionLoading(false);
      setModal(null);
      setTarget(null);
    }
  }

  const filtered = clients.filter((c) => {
    if (filter === "all")      return true;
    if (filter === "active")   return c.status === "active";
    if (filter === "paused")   return c.status === "paused";
    if (filter === "archived") return c.status === "archived" || c.status === "completed";
    return true;
  });

  const activeCount = clients.filter((c) => c.status === "active").length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "#F7F3EE" }}>
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Клиенты</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {activeCount} активных {activeCount === 1 ? "процесс" : "процесса"}
            </p>
          </div>
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
            const count = f.id === "all" ? clients.length :
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
              <div key={i} className="rounded-2xl border p-6 h-52 animate-pulse" style={{ background: "#F0EBE1", borderColor: "#E2D9CC" }} />
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
              <div
                key={client.id}
                className="rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col"
                style={{ background: "#F0EBE1", borderColor: "#E2D9CC" }}
              >
                {/* Body */}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar initials={client.initials} color={client.color} size="lg" />
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-800 truncate">{client.name}</h2>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[client.status]}`}>
                          {STATUS_LABEL[client.status]}
                        </span>
                      </div>
                    </div>
                    {/* Delete — top right */}
                    <Tip text="Удалить клиента и все данные навсегда">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal("delete", client); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0 ml-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tip>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-stone-500">
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
                          className="px-2 py-0.5 rounded-full text-xs text-stone-600"
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

                {/* Footer: open button + pause/archive */}
                <div className="px-5 pb-4 flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/client/${client.id}`)}
                    className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl text-stone-600 text-sm font-medium transition-colors group hover:bg-brand-50 hover:text-brand-600"
                    style={{ background: "#E8E0D0" }}
                  >
                    Открыть карточку
                    <ArrowRight size={14} className="text-stone-400 group-hover:text-brand-400 transition-colors" />
                  </button>

                  {/* Pause / Archive — only for real clients */}
                  {!client.isMock && (
                    <>
                      {client.status !== "paused" && client.status !== "archived" && client.status !== "completed" && (
                        <Tip text="Пауза: клиент временно не ходит, работа может быть продолжена">
                          <button
                            onClick={() => openModal("pause", client)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            style={{ background: "#E8E0D0" }}
                          >
                            <Pause size={15} />
                          </button>
                        </Tip>
                      )}
                      {client.status !== "archived" && client.status !== "completed" && (
                        <Tip text="Архив: случай закрыт, данные сохраняются">
                          <button
                            onClick={() => openModal("archive", client)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-slate-600 hover:bg-stone-200 transition-colors"
                            style={{ background: "#E8E0D0" }}
                          >
                            <Archive size={15} />
                          </button>
                        </Tip>
                      )}
                      {(client.status === "paused" || client.status === "archived" || client.status === "completed") && (
                        <Tip text="Вернуть в активные">
                          <button
                            onClick={() => handleStatusChange("active")}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                            style={{ background: "#E8E0D0" }}
                          >
                            ↩
                          </button>
                        </Tip>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Add card — only in active tab */}
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

      {/* Modals */}
      {modal === "delete" && target && (
        <Confirm
          title={`Удалить клиента ${target.name}?`}
          body="Будут удалены клиент, его консультации, история клиента и материалы. Это действие нельзя отменить."
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
          body="Клиент останется в системе, но будет отображаться в разделе «Пауза». Все консультации, материалы и история клиента сохранятся."
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
          body="Клиент исчезнет из списка активных клиентов, но все консультации, материалы, история клиента и анализы сохранятся."
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
