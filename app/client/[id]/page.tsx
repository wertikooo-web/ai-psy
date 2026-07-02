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
import { Mic, ArrowLeft, Trash2, Pause, Archive, RotateCcw, ChevronRight } from "lucide-react";

type Tab = "overview" | "consultations" | "history" | "materials";

const TABS: { id: Tab; label: string; tooltip: string }[] = [
  { id: "overview",      label: "Запрос",        tooltip: "Текущий запрос клиента и история его изменений.\nЗдесь фиксируется, с чем клиент пришёл и как это менялось."          },
  { id: "consultations", label: "Консультации",  tooltip: "Список всех сессий с транскриптами и AI-анализами.\nОткройте любую консультацию для детального разбора."                          },
  { id: "history",       label: "История",       tooltip: "Хронология важных событий и фактов жизни клиента.\nПомогает понимать контекст при подготовке к сессии."                           },
  { id: "materials",     label: "Материалы",     tooltip: "Наблюдения и доп. документы: старые анализы, транскрипты, тексты.\nПодключаются как контекст при AI-анализе новых сессий."        },
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
  const [currentRequestText, setCurrentRequestText] = useState<string | null>(null);
  const [requestsMap, setRequestsMap]               = useState<Record<string, string>>({});
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
      fetch(`/api/client-requests/${id}`).then((r) => r.json()),
    ]).then(([clients, consultations, history, mats, reqs]) => {
      setRealClient((clients as StoredClient[]).find((c) => c.id === id) ?? null);
      setRealSessions((consultations as StoredConsultation[]).filter((c) => c.clientId === id));
      setHistoryItems(history as ClientHistoryItem[]);
      setMaterials(mats as ClientMaterial[]);
      const cur = Array.isArray(reqs) ? reqs.find((r: { isCurrent: boolean }) => r.isCurrent) : null;
      setCurrentRequestText(cur?.text ?? null);
      if (Array.isArray(reqs)) {
        const map: Record<string, string> = {};
        for (const r of reqs as { id: string; text: string }[]) map[r.id] = r.text;
        setRequestsMap(map);
      }
    }).catch(() => {}).finally(() => setDataLoading(false));
  }, [id, isMock]);

  // Keep materials state in sync with observations created/updated via FAB
  useEffect(() => {
    function onCreated(e: CustomEvent) {
      const obs = e.detail?.observation as import("@/lib/types").ClientMaterial;
      if (!obs || obs.clientId !== id) return;
      setMaterials((prev) => [obs, ...prev.filter((m) => m.id !== obs.id)]);
    }
    function onUpdated(e: CustomEvent) {
      if (e.detail?.clientId !== id) return;
      const { tempId, observation } = e.detail as { tempId: string; observation: import("@/lib/types").ClientMaterial };
      setMaterials((prev) => prev.map((m) => m.id === tempId ? observation : m));
    }
    window.addEventListener("observation-created", onCreated as EventListener);
    window.addEventListener("observation-updated", onUpdated as EventListener);
    return () => {
      window.removeEventListener("observation-created", onCreated as EventListener);
      window.removeEventListener("observation-updated", onUpdated as EventListener);
    };
  }, [id]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: "inherit" }}>

      {/* ── MOBILE LAYOUT ─────────────────────────────────────── */}
      <div className="lg:hidden flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: "#FBF8F5" }}>

        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b" style={{ background: "#FBF8F5", borderColor: "#CFC0A9" }}>
          <Link href="/clients" style={{ color: "#3a5ff8", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </Link>
          <span className="flex-1 text-base font-semibold truncate" style={{ color: "#3D3228" }}>{client?.name}</span>
          <button onClick={() => setUploadOpen(true)} style={{ background: "#3a5ff8", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <Mic size={13} /> Запись
          </button>
        </div>

        {/* Client card */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#F3EBDD", borderColor: "#CFC0A9" }}>
          <Avatar initials={client.initials} color={client.color} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold truncate" style={{ color: "#3D3228" }}>{client.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>{st.label}</span>
            </div>
            <span className="text-xs" style={{ color: "#A8997F" }}>{sessionCount} встреч</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex-shrink-0 flex border-b overflow-x-auto" style={{ borderColor: "#CFC0A9", background: "#FBF8F5" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{ color: tab === t.id ? "#3a5ff8" : "#A8997F", borderBottom: tab === t.id ? "2px solid #3a5ff8" : "2px solid transparent", background: "none", border: "none", cursor: "pointer", borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: tab === t.id ? "#3a5ff8" : "transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — mobile simplified */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "12px 16px 80px" }}>
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentRequestText ? (
                <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#3D3228", lineHeight: 1.55 }}>
                  {currentRequestText}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#C9BBAA", fontSize: 13 }}>Запрос не указан</div>
              )}
              <button onClick={() => setUploadOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", background: "#3a5ff8", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
                <Mic size={15} /> Новая консультация
              </button>
            </div>
          )}
          {tab === "consultations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isMock ? (
                mockSessionsForClient.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#C9BBAA", fontSize: 13 }}>Консультаций нет</div>
                ) : mockSessionsForClient.map((s) => (
                  <Link key={s.id} href={`/consultation/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 12, textDecoration: "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.topic || "Консультация"}</div>
                      <div style={{ fontSize: 11, color: "#A8997F", marginTop: 2 }}>{s.date}</div>
                    </div>
                    <ChevronRight size={16} color="#C9BBAA" />
                  </Link>
                ))
              ) : (
                realSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#C9BBAA", fontSize: 13 }}>Консультаций нет</div>
                ) : realSessions.map((s) => (
                  <Link key={s.id} href={`/consultation/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 12, textDecoration: "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "Консультация"}</div>
                      <div style={{ fontSize: 11, color: "#A8997F", marginTop: 2 }}>{new Date(s.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                    </div>
                    <ChevronRight size={16} color="#C9BBAA" />
                  </Link>
                ))
              )}
            </div>
          )}
          {tab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {historyItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#C9BBAA", fontSize: 13 }}>История пуста</div>
              ) : historyItems.map((item) => (
                <div key={item.id} style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3228" }}>{item.section}</div>
                  <div style={{ fontSize: 12, color: "#6B5D4F", marginTop: 4, lineHeight: 1.5 }}>{item.text}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "materials" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {materials.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#C9BBAA", fontSize: 13 }}>Материалов нет</div>
              ) : materials.map((m) => (
                <div key={m.id} style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title || m.fileName}</div>
                  </div>
                  <ChevronRight size={16} color="#C9BBAA" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP LAYOUT ────────────────────────────────────── */}
      <div className="hidden lg:block flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
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
                <p className="text-sm text-slate-400 mt-0.5">{age} лет</p>
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
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  color: "#EF4444",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FCA5A5"; e.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#EF4444"; }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation — underline on mobile, pills on desktop */}
        <div className="sm:hidden flex border-b overflow-x-auto" style={{ borderColor: "#CFC0A9" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: tab === t.id ? "#3a5ff8" : "#A8997F",
                borderBottom: tab === t.id ? "2px solid #3a5ff8" : "2px solid transparent",
                background: "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex gap-1 bg-stone-300 rounded-xl p-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.tooltip}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
            clientId={id}
            isMock={isMock}
            mockSessions={isMock ? mockSessionsForClient : []}
            onCurrentRequestChange={(text) => setCurrentRequestText(text)}
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
            requestsMap={requestsMap}
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
      </div>{/* end hidden lg:block desktop */}

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
