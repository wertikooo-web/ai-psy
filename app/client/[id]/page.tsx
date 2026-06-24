"use client";

import { useState, useEffect, use } from "react";
import { clients as mockClients, consultations as mockConsultations } from "@/lib/mockData";
import { mockHistoryItems } from "@/lib/mockHistoryData";
import type { StoredClient } from "@/lib/clientStore";
import type { StoredConsultation } from "@/lib/consultationStore";
import type { ClientHistoryItem, ClientMaterial } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import { OverviewTab } from "@/components/client/tabs/OverviewTab";
import { ConsultationsTab } from "@/components/client/tabs/ConsultationsTab";
import { HistoryTab } from "@/components/client/tabs/HistoryTab";
import { MaterialsTab } from "@/components/client/tabs/MaterialsTab";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, ArrowLeft, Trash2, Pause, Archive, RotateCcw } from "lucide-react";

type Tab = "overview" | "consultations" | "history" | "materials";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",      label: "Обзор"            },
  { id: "consultations", label: "Консультации"      },
  { id: "history",       label: "История клиента"   },
  { id: "materials",     label: "Материалы"         },
];

const statusLabel: Record<string, { label: string; cls: string }> = {
  active:    { label: "активный",  cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  paused:    { label: "пауза",     cls: "bg-amber-50 text-amber-600 border-amber-100" },
  archived:  { label: "архив",     cls: "bg-stone-100 text-stone-500 border-stone-200" },
  completed: { label: "завершён",  cls: "bg-stone-100 text-stone-500 border-stone-200" },
};

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [tab, setTab]                     = useState<Tab>("overview");
  const [uploadOpen, setUploadOpen]       = useState(false);
  const [realClient, setRealClient]       = useState<StoredClient | null>(null);
  const [realSessions, setRealSessions]   = useState<StoredConsultation[]>([]);
  const [historyItems, setHistoryItems]   = useState<ClientHistoryItem[]>([]);
  const [materials, setMaterials]         = useState<ClientMaterial[]>([]);
  const [deletingClient, setDeletingClient]   = useState(false);
  const [statusChanging, setStatusChanging]   = useState(false);
  const [dataLoading, setDataLoading]         = useState(true);

  // Reload real sessions after a new upload
  function reloadRealSessions() {
    if (isMock) return;
    fetch("/api/consultations")
      .then((r) => r.json())
      .then((all: StoredConsultation[]) => setRealSessions(all.filter((c) => c.clientId === id)))
      .catch(() => {});
  }

  const mockClient = mockClients.find((c) => c.id === id);
  const isMock     = !!mockClient;
  const client     = mockClient ?? realClient;

  // Load data for real clients
  useEffect(() => {
    if (isMock) {
      setHistoryItems(mockHistoryItems.filter((i) => i.clientId === id));
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/consultations").then((r) => r.json()),
      fetch(`/api/client-history/${id}`).then((r) => r.json()),
      fetch(`/api/client-materials/${id}`).then((r) => r.json()),
    ]).then(([clients, consultations, history, mats]) => {
      setRealClient((clients as StoredClient[]).find((c) => c.id === id) ?? null);
      setRealSessions((consultations as StoredConsultation[]).filter((c) => c.clientId === id));
      setHistoryItems(history as ClientHistoryItem[]);
      setMaterials(mats as ClientMaterial[]);
    }).catch(() => {}).finally(() => setDataLoading(false));
  }, [id, isMock]);

  if (dataLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Клиент не найден.{" "}
        <Link href="/" className="text-brand-500 underline">На главную</Link>
      </div>
    );
  }

  const mockSessionsForClient = mockConsultations
    .filter((c) => c.clientId === id)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);

  const sessionCount = isMock ? mockSessionsForClient.length : realSessions.length;
  const uploadBtnLabel = sessionCount === 0 ? "Загрузить первую запись" : "Новая запись";

  const st = statusLabel[client.status] ?? statusLabel.active;

  async function handleDeleteClient() {
    if (!confirm(`Удалить клиента «${client!.name}» и все его записи? Это действие нельзя отменить.`)) return;
    setDeletingClient(true);
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
      router.push("/clients");
    } catch {
      setDeletingClient(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (isMock) return;
    setStatusChanging(true);
    try {
      await fetch(`/api/clients/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      // reload client data
      const res = await fetch("/api/clients");
      const all = await res.json();
      setRealClient(all.find((c: { id: string }) => c.id === id) ?? null);
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    await fetch(`/api/consultations/${sessionId}`, { method: "DELETE" });
    setRealSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-6 max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={14} />
          Клиенты
        </Link>

        {/* Status banner for paused/archived */}
        {!isMock && client.status === "paused" && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <Pause size={15} />
              Клиент на паузе
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange("archived")}
                disabled={statusChanging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium transition-colors disabled:opacity-60"
              >
                <Archive size={12} />
                В архив
              </button>
              <button
                onClick={() => handleStatusChange("active")}
                disabled={statusChanging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium transition-colors disabled:opacity-60"
              >
                <RotateCcw size={12} />
                Вернуть в активные
              </button>
            </div>
          </div>
        )}
        {!isMock && (client.status === "archived" || client.status === "completed") && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-stone-100 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-600 text-sm font-medium">
              <Archive size={15} />
              Клиент находится в архиве
            </div>
            <button
              onClick={() => handleStatusChange("active")}
              disabled={statusChanging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium transition-colors disabled:opacity-60"
            >
              <RotateCcw size={12} />
              Вернуть в активные
            </button>
          </div>
        )}

        {/* Client header */}
        <div className="flex items-start gap-4">
          <Avatar initials={client.initials} color={client.color} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-800">{client.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                {st.label}
              </span>
            </div>
            {(() => {
              const age = "age" in client ? (client as { age?: number }).age : undefined;
              return age ? (
                <p className="text-sm text-slate-400 mt-0.5">
                  {age} лет{client.concern ? ` · ${client.concern}` : ""}
                </p>
              ) : client.concern ? (
                <p className="text-sm text-slate-400 mt-0.5">{client.concern}</p>
              ) : null;
            })()}
            <p className="text-xs text-slate-400 mt-1">
              {isMock
                ? `${mockSessionsForClient.length} встреч`
                : `${realSessions.length} встреч`}
              {client.lastConsultation
                ? ` · последняя ${new Date(client.lastConsultation).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              <Mic size={13} />
              {uploadBtnLabel}
            </button>
            {!isMock && (
              <button
                onClick={handleDeleteClient}
                disabled={deletingClient}
                title="Удалить клиента"
                className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                style={{
                  width: 34, height: 34,
                  background: "#FFFFFF",
                  border: "1px solid #D8CFBE",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  color: "#6B5D4F",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#D8CFBE"; }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100/60 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab
            client={client}
            mockSessions={isMock ? mockSessionsForClient : []}
          />
        )}

        {tab === "consultations" && (
          <ConsultationsTab
            isMock={isMock}
            mockSessions={isMock ? mockSessionsForClient : []}
            realSessions={realSessions}
            onUpload={() => setUploadOpen(true)}
            uploadBtnLabel={uploadBtnLabel}
            onDeleteSession={handleDeleteSession}
          />
        )}

        {tab === "history" && (
          <HistoryTab
            clientId={id}
            items={historyItems}
            isMock={isMock}
            onAdd={(item) => setHistoryItems((prev) => [...prev, item])}
            onDelete={(itemId) => setHistoryItems((prev) => prev.filter((i) => i.id !== itemId))}
          />
        )}

        {tab === "materials" && (
          <MaterialsTab
            clientId={id}
            materials={materials}
            isMock={isMock}
            onAdd={(m) => setMaterials((prev) => [m, ...prev])}
            onDelete={(mid) => setMaterials((prev) => prev.filter((m) => m.id !== mid))}
          />
        )}

      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); reloadRealSessions(); }}
        presetClientId={id}
        presetClientName={client?.name}
        presetClientInitials={client?.initials}
        presetClientColor={client?.color}
      />
    </div>
  );
}
