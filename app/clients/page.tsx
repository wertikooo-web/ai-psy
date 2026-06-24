"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AddClientModal } from "@/components/client/AddClientModal";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";

type AnyClient = StoredClient & { isMock?: boolean };

const statusLabel: Record<string, string> = {
  active: "активный",
  paused: "пауза",
  completed: "завершён",
};

const statusColor: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-600",
  paused: "bg-amber-50 text-amber-600",
  completed: "bg-slate-100 text-slate-500",
};

interface DeleteConfirmProps {
  client: AnyClient;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteConfirm({ client, onCancel, onConfirm, loading }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-2">
          Удалить клиента {client.name}?
        </h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Будут удалены клиент, его консультации, история клиента и материалы. Это действие нельзя отменить.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Удаляю..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<AnyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnyClient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadClients() {
    try {
      const res = await fetch("/api/clients");
      const real: StoredClient[] = res.ok ? await res.json() : [];
      const realIds = new Set(real.map((c) => c.id));
      const merged: AnyClient[] = [
        ...real,
        ...mockClients
          .filter((m) => !realIds.has(m.id))
          .map((m) => ({ ...m, isMock: true } as AnyClient)),
      ];
      setClients(merged);
    } catch {
      setClients(mockClients.map((m) => ({ ...m, isMock: true } as AnyClient)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.isMock) {
      setDeleteTarget(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await fetch(`/api/clients/${deleteTarget.id}`, { method: "DELETE" });
      await loadClients();
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  const activeCount = clients.filter((c) => c.status === "active").length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Клиенты</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {activeCount} активных терапевтических {activeCount === 1 ? "процесс" : "процесса"}
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

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 h-52 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-100 transition-all flex flex-col"
              >
                {/* Card top */}
                <div className="p-5 flex-1">
                  {/* Avatar + name row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar initials={client.initials} color={client.color} size="lg" />
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-800 truncate">{client.name}</h2>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[client.status]}`}>
                          {statusLabel[client.status]}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(client); }}
                      title="Удалить клиента"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0 ml-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Users size={11} />
                      <span>{client.totalConsultations} встреч</span>
                    </div>
                    {client.lastConsultation && (
                      <span>
                        {new Date(client.lastConsultation).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>

                  {/* Concern */}
                  {client.concern && (
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                      {client.concern}
                    </p>
                  )}

                  {/* Topics */}
                  {client.mainTopics?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {client.mainTopics.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-50 border border-slate-100"
                        >
                          {t}
                        </span>
                      ))}
                      {client.mainTopics.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-xs text-slate-400">
                          +{client.mainTopics.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="px-5 pb-4">
                  <button
                    onClick={() => router.push(`/client/${client.id}`)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-sm font-medium transition-colors group"
                  >
                    Открыть карточку
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add client card */}
            <button
              onClick={() => setAddOpen(true)}
              className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/30 transition-all min-h-[220px]"
            >
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
                <Plus size={20} />
              </div>
              <span className="text-sm font-medium">Добавить клиента</span>
            </button>
          </div>
        )}
      </div>

      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); loadClients(); }}
      />

      {deleteTarget && (
        <DeleteConfirm
          client={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
