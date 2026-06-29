"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FilePlus2,
  Filter,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { NotebookEntry } from "@/lib/notebookStore";

const TOPICS = [
  "Идея",
  "Напоминание",
  "Супервизия",
  "Методика",
  "Организационное",
  "Клиентская работа",
  "Другое",
];

type SortMode  = "newest" | "oldest" | "updated" | "client" | "topic";
type GroupMode = "none" | "date" | "client" | "topic";
type DateMode  = "all" | "today" | "7d" | "30d" | "custom";

interface ClientOption {
  id:   string;
  name: string;
}

interface NotebookResponse {
  entries:    NotebookEntry[];
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

interface QueryState {
  page:   number;
  search: string;
  client: string;
  topic:  string;
  tags:   string;
  sort:   SortMode;
  group:  GroupMode;
  date:   DateMode;
  from:   string;
  to:     string;
}

interface FormState {
  id?:      string;
  title:    string;
  text:     string;
  clientId: string;
  topic:    string;
  tags:     string;
}

const emptyForm: FormState = { title: "", text: "", clientId: "", topic: "", tags: "" };

const DEFAULT_QUERY: QueryState = {
  page: 1, search: "", client: "", topic: "", tags: "",
  sort: "newest", group: "none", date: "all", from: "", to: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readInitialQuery(): QueryState {
  if (typeof window === "undefined") return DEFAULT_QUERY;
  const sp = new URLSearchParams(window.location.search);
  return {
    page:   Math.max(1, Number(sp.get("page") ?? 1) || 1),
    search: sp.get("search") ?? "",
    client: sp.get("client") ?? "",
    topic:  sp.get("topic")  ?? "",
    tags:   sp.get("tags")   ?? "",
    sort:   (sp.get("sort")  as SortMode)  || "newest",
    group:  (sp.get("group") as GroupMode) || "none",
    date:   (sp.get("date")  as DateMode)  || "all",
    from:   sp.get("from")   ?? "",
    to:     sp.get("to")     ?? "",
  };
}

function writeUrl(query: QueryState) {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams();
  if (query.page > 1)           sp.set("page",   String(query.page));
  if (query.search)             sp.set("search", query.search);
  if (query.client)             sp.set("client", query.client);
  if (query.topic)              sp.set("topic",  query.topic);
  if (query.tags)               sp.set("tags",   query.tags);
  if (query.sort  !== "newest") sp.set("sort",   query.sort);
  if (query.group !== "none")   sp.set("group",  query.group);
  if (query.date  !== "all")    sp.set("date",   query.date);
  if (query.from)               sp.set("from",   query.from);
  if (query.to)                 sp.set("to",     query.to);
  const next = sp.toString() ? `/notebook?${sp.toString()}` : "/notebook";
  window.history.replaceState(null, "", next);
}

function formatDate(iso: string) {
  const d    = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function formatDateGroup(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function pluralNotes(n: number) {
  if (n % 100 >= 11 && n % 100 <= 14) return `${n} записей`;
  const m = n % 10;
  if (m === 1) return `${n} запись`;
  if (m >= 2 && m <= 4) return `${n} записи`;
  return `${n} записей`;
}

function groupTitle(entry: NotebookEntry | undefined, group: GroupMode) {
  if (!entry || group === "none") return "";
  if (group === "date")   return formatDateGroup(entry.createdAt);
  if (group === "client") return entry.clientName ?? "Без клиента";
  return entry.topic ?? "Без темы";
}

function tagsToArray(tags: string) {
  const seen = new Set<string>();
  tags.split(",").forEach((raw) => {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 32);
    if (tag) seen.add(tag);
  });
  return [...seen].slice(0, 8);
}

function entryToForm(entry: NotebookEntry): FormState {
  return {
    id:       entry.id,
    title:    entry.title ?? "",
    text:     entry.text,
    clientId: entry.clientId ?? "",
    topic:    entry.topic    ?? "",
    tags:     entry.tags.join(", "),
  };
}

// ── Decorative spiral binding strip ──────────────────────────────────────────

function BindingStrip({ count = 13, small = false }: { count?: number; small?: boolean }) {
  const height = small ? 32 : 40;
  const rSize  = small ? 14 : 18;
  const gap    = small ? "gap-4" : "gap-6";
  return (
    <div
      className={`flex items-center justify-center ${gap} bg-[#BCA886]`}
      style={{ height }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 rounded-full border-2 border-[#8B6E49] bg-[#F7F3EA]"
          style={{
            width:     rSize,
            height:    rSize,
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <div
            className="rounded-full bg-[#EDE4D3]/60"
            style={{ margin: 3, width: rSize - 10, height: rSize - 10 }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D241C]/40 p-4">
      <div className="notebook-paper w-full max-w-sm overflow-hidden rounded-2xl border border-[#CFC0A9] shadow-2xl">
        <BindingStrip count={7} small />
        <div className="p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#FEE2E2] bg-[#FEF3F2]">
            <Trash2 size={17} className="text-[#B42318]" />
          </div>
          <p className="text-base font-semibold text-[#3D3228]">Удалить эту запись?</p>
          <p className="mt-1.5 text-sm text-[#8F7F69]">
            Запись будет помечена как удалённая. Клиент и его материалы не затрагиваются.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-xl border border-[#D8CFBE] bg-white/75 px-4 py-2 text-sm font-medium text-[#4D4034] hover:bg-[#F5F0E6]"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              className="rounded-xl bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991B1B]"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const [query, setQuery]                     = useState<QueryState>(DEFAULT_QUERY);
  const [debouncedSearch, setDebouncedSearch] = useState(query.search);
  const [data, setData]                       = useState<NotebookResponse>({
    entries: [], page: 1, pageSize: 3, total: 0, totalPages: 1,
  });
  const [clients, setClients]                 = useState<ClientOption[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [filtersOpen, setFiltersOpen]         = useState(false);
  const [formOpen, setFormOpen]               = useState(false);
  const [form, setForm]                       = useState<FormState>(emptyForm);
  const [toast, setToast]                     = useState("");
  const [turnDirection, setTurnDirection]     = useState<"next" | "prev" | "none">("none");
  const [openMenu, setOpenMenu]               = useState<string | null>(null);
  const [reloadKey, setReloadKey]             = useState(0);
  const [deleteTarget, setDeleteTarget]       = useState<string | null>(null);

  useEffect(() => { setQuery(readInitialQuery()); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(query.search), 300);
    return () => window.clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((items) =>
        setClients((items as ClientOption[]).map((c) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => setClients([]));
  }, []);

  const requestParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(query.page));
    if (debouncedSearch) sp.set("search", debouncedSearch);
    if (query.client)    sp.set("client", query.client);
    if (query.topic)     sp.set("topic",  query.topic);
    if (query.tags)      sp.set("tags",   query.tags);
    if (query.sort)      sp.set("sort",   query.sort);
    if (query.group)     sp.set("group",  query.group);
    if (query.date)      sp.set("date",   query.date);
    if (query.from)      sp.set("from",   query.from);
    if (query.to)        sp.set("to",     query.to);
    return sp;
  }, [debouncedSearch, query]);

  useEffect(() => { writeUrl(query); }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/notebook?${requestParams.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: NotebookResponse) => { if (!cancelled) setData(json); })
      .catch(() => {
        if (!cancelled)
          setData({ entries: [], page: query.page, pageSize: 3, total: 0, totalPages: 1 });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestParams, query.page, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeFilters = [
    query.client,
    query.topic,
    query.tags,
    query.date !== "all" ? query.date : "",
    query.from,
    query.to,
  ].filter(Boolean).length;

  function updateQuery(patch: Partial<QueryState>, resetPage = true) {
    setQuery((prev) => ({
      ...prev,
      ...patch,
      page: resetPage ? 1 : patch.page ?? prev.page,
    }));
  }

  function openNewEntry() { setForm(emptyForm); setFormOpen(true); setOpenMenu(null); }
  function openEdit(entry: NotebookEntry) {
    setForm(entryToForm(entry));
    setFormOpen(true);
    setOpenMenu(null);
  }

  async function saveEntry() {
    const text = form.text.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const payload = {
        title:    form.title.trim(),
        text,
        clientId: form.clientId || undefined,
        topic:    form.topic    || undefined,
        tags:     tagsToArray(form.tags),
      };
      const res = await fetch(
        form.id ? `/api/notebook/${form.id}` : "/api/notebook",
        {
          method:  form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        },
      );
      if (!res.ok) return;
      setFormOpen(false);
      setToast(form.id ? "Запись сохранена" : "Запись добавлена");
      if (form.id) {
        setData((prev) => ({
          ...prev,
          entries: prev.entries.map((e) =>
            e.id === form.id
              ? { ...e, ...payload, tags: payload.tags, updatedAt: new Date().toISOString() }
              : e,
          ),
        }));
        setReloadKey((v) => v + 1);
      } else {
        updateQuery({ page: 1 }, false);
        setReloadKey((v) => v + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  function initiateDelete(id: string) { setDeleteTarget(id); setOpenMenu(null); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    const res = await fetch(`/api/notebook/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setToast("Запись удалена");
    if (data.entries.length === 1 && query.page > 1) {
      updateQuery({ page: query.page - 1 }, false);
    } else {
      setData((prev) => ({
        ...prev,
        total:   Math.max(0, prev.total - 1),
        entries: prev.entries.filter((e) => e.id !== id),
      }));
      setReloadKey((v) => v + 1);
    }
  }

  async function addToMaterials(entry: NotebookEntry) {
    if (!entry.clientId) { setToast("Сначала свяжите запись с клиентом"); return; }
    const res = await fetch(`/api/notebook/${entry.id}/material`, { method: "POST" });
    setToast(res.ok ? "Добавлено в материалы клиента" : "Не удалось добавить в материалы");
    setOpenMenu(null);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > data.totalPages || nextPage === query.page) return;
    setTurnDirection(nextPage > query.page ? "next" : "prev");
    updateQuery({ page: nextPage }, false);
    window.setTimeout(() => setTurnDirection("none"), 360);
  }

  function resetFilters() {
    updateQuery({
      search: "", client: "", topic: "", tags: "",
      date: "all", from: "", to: "", group: "none", sort: "newest",
    });
    setFiltersOpen(false);
  }

  const isFiltered = activeFilters > 0 || !!query.search;
  const heading    = groupTitle(data.entries[0], query.group);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F3EA]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">

        {/* ── Page header ── */}
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8CFBE] bg-[#E9DCC7]">
              <BookOpen size={18} className="text-[#6B5D4F]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#3D3228]">Блокнот психолога</h1>
              <p className="text-sm text-[#8F7F69]">Личные записи, идеи, наблюдения и напоминания</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[240px] flex-1 sm:flex-none">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8A72]" />
              <input
                value={query.search}
                onChange={(e) => updateQuery({ search: e.target.value })}
                placeholder="Поиск по тексту, клиенту, теме, тегам"
                className="h-10 w-full rounded-xl border border-[#D8CFBE] bg-white/80 pl-9 pr-3 text-sm text-[#3D3228] outline-none focus:border-[#6088ff] focus:ring-2 focus:ring-[#6088ff]/15"
              />
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                filtersOpen || activeFilters > 0
                  ? "border-[#6088ff] bg-[#EEF2FF] text-[#355E9C]"
                  : "border-[#D8CFBE] bg-white/80 text-[#4D4034] hover:bg-white"
              }`}
            >
              <Filter size={15} />
              Фильтры{activeFilters > 0 ? ` · ${activeFilters}` : ""}
            </button>

            {/* Sort */}
            <select
              value={query.sort}
              onChange={(e) => updateQuery({ sort: e.target.value as SortMode })}
              className="h-10 rounded-xl border border-[#D8CFBE] bg-white/80 px-3 text-sm text-[#4D4034] outline-none focus:border-[#6088ff]"
            >
              <option value="newest">Сортировка: сначала новые</option>
              <option value="oldest">Сортировка: сначала старые</option>
              <option value="updated">Сортировка: недавно изменённые</option>
              <option value="client">Сортировка: по клиенту</option>
              <option value="topic">Сортировка: по теме</option>
            </select>

            {/* Group */}
            <select
              value={query.group}
              onChange={(e) => updateQuery({ group: e.target.value as GroupMode })}
              className="h-10 rounded-xl border border-[#D8CFBE] bg-white/80 px-3 text-sm text-[#4D4034] outline-none focus:border-[#6088ff]"
            >
              <option value="none">Группировка: нет</option>
              <option value="date">Группировка: по дате</option>
              <option value="client">Группировка: по клиенту</option>
              <option value="topic">Группировка: по теме</option>
            </select>

            {/* New entry */}
            <button
              onClick={openNewEntry}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#4A3C2E] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#3A2E22]"
            >
              <Plus size={15} />
              Новая запись
            </button>
          </div>
        </div>

        {/* ── Filter panel ── */}
        {filtersOpen && (
          <div className="mb-5 grid gap-3 rounded-2xl border border-[#D8CFBE] bg-[#FBF8F2] p-4 shadow-sm md:grid-cols-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8F7F69]">
              Клиент
              <select
                value={query.client}
                onChange={(e) => updateQuery({ client: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm normal-case tracking-normal text-[#3D3228]"
              >
                <option value="">Все записи</option>
                <option value="none">Без клиента</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8F7F69]">
              Тема
              <select
                value={query.topic}
                onChange={(e) => updateQuery({ topic: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm normal-case tracking-normal text-[#3D3228]"
              >
                <option value="">Все темы</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="mt-1 block text-[11px] normal-case tracking-normal text-[#A8997F]">
                Тема задаётся при создании или редактировании записи.
              </span>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8F7F69]">
              Дата
              <select
                value={query.date}
                onChange={(e) => updateQuery({ date: e.target.value as DateMode })}
                className="mt-1 h-10 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm normal-case tracking-normal text-[#3D3228]"
              >
                <option value="all">Все даты</option>
                <option value="today">Сегодня</option>
                <option value="7d">Последние 7 дней</option>
                <option value="30d">Последние 30 дней</option>
                <option value="custom">Произвольный период</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8F7F69]">
              Теги
              <input
                value={query.tags}
                onChange={(e) => updateQuery({ tags: e.target.value })}
                placeholder="СДВГ, группа"
                className="mt-1 h-10 w-full rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm normal-case tracking-normal text-[#3D3228] outline-none"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="h-10 w-full rounded-xl border border-[#CBBBA4] bg-white px-3 text-sm font-medium text-[#4D4034] hover:bg-[#F5F0E6]"
              >
                Сбросить фильтры
              </button>
            </div>
            {query.date === "custom" && (
              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <input
                  type="date"
                  value={query.from}
                  onChange={(e) => updateQuery({ from: e.target.value })}
                  className="h-10 rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm text-[#3D3228]"
                />
                <input
                  type="date"
                  value={query.to}
                  onChange={(e) => updateQuery({ to: e.target.value })}
                  className="h-10 rounded-xl border border-[#D8CFBE] bg-white px-3 text-sm text-[#3D3228]"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Notebook container ── */}
        <div className="relative mx-auto max-w-4xl">
          {/* Right page stack: two layers give a stacked-pages effect */}
          <div className="absolute -right-2.5 top-14 hidden h-[78%] w-7 rounded-r-3xl border border-l-0 border-[#C9B89E] bg-[#E5D8C3] shadow-sm sm:block" />
          <div className="absolute -right-0.5 top-16 hidden h-[72%] w-3.5 rounded-r-2xl border border-l-0 border-[#D3C4AB] bg-[#EDE4D3] sm:block" />

          {/* Main notebook paper */}
          <div className="notebook-paper relative overflow-hidden rounded-[28px] border border-[#CFC0A9] shadow-[0_24px_70px_rgba(83,63,42,0.16),0_4px_12px_rgba(83,63,42,0.08)]">

            {/* Spiral binding strip */}
            <BindingStrip count={13} />

            {/* Red left margin line (starts below the binding strip) */}
            <div className="absolute left-[52px] top-10 h-[calc(100%-40px)] w-px bg-[#D9A6A0]/65 hidden sm:block" />

            {/* Paper content area */}
            <div className="px-5 py-5 sm:px-10 sm:py-6">

              {/* Inner notebook header */}
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#E2D8C8] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A8A72]">
                    Личный блокнот
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B5D4F]">
                    {pluralNotes(data.total)}
                  </p>
                </div>
                {/* Small decorative dots mirroring binder holes from the side */}
                <div className="flex gap-1.5 opacity-50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 rounded-full border border-[#B7A48D] bg-[#F0E9DC] shadow-inner"
                    />
                  ))}
                </div>
              </div>

              {/* Group heading */}
              {heading && (
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D8CFBE] bg-white/70 px-3 py-1">
                    <span className="text-xs font-semibold text-[#6B5D4F]">{heading}</span>
                    <span className="text-[10px] text-[#9A8A72]">·</span>
                    <span className="text-xs text-[#9A8A72]">
                      {pluralNotes(data.entries.length)} на этой странице
                    </span>
                  </div>
                </div>
              )}

              {/* Entry list with page-turn animation wrapper */}
              <div
                className={`notebook-turn ${
                  turnDirection === "next"
                    ? "notebook-turn-next"
                    : turnDirection === "prev"
                    ? "notebook-turn-prev"
                    : ""
                }`}
              >
                {loading ? (
                  <div className="flex min-h-[380px] items-center justify-center">
                    <Loader2 size={26} className="animate-spin text-[#8F7F69]" />
                  </div>
                ) : data.entries.length === 0 ? (
                  /* ── Empty state ── */
                  <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-[#C6B69B] bg-[#F1E9DC]">
                      <BookOpen size={28} className="text-[#B0997D]" />
                    </div>
                    <p className="text-base font-semibold text-[#3D3228]">
                      {isFiltered ? "Записей с такими параметрами нет" : "Ваш блокнот пока пуст"}
                    </p>
                    <p className="mt-2 max-w-xs text-sm text-[#8F7F69]">
                      {isFiltered
                        ? "Попробуйте изменить поиск или сбросить фильтры."
                        : "Создайте первую запись — мысль, идею, наблюдение или напоминание."}
                    </p>
                    <button
                      onClick={isFiltered ? resetFilters : openNewEntry}
                      className="mt-5 flex items-center gap-2 rounded-xl bg-[#4A3C2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A2E22]"
                    >
                      {isFiltered ? <X size={14} /> : <Plus size={14} />}
                      {isFiltered ? "Сбросить фильтры" : "+ Новая запись"}
                    </button>
                  </div>
                ) : (
                  /* ── Entries ── */
                  <div className="divide-y divide-dashed divide-[#D9CDB9]">
                    {data.entries.map((entry) => (
                      <article key={entry.id} className="py-4 first:pt-0 last:pb-1">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9A8A72]">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays size={12} />
                                {formatDate(entry.createdAt)}
                              </span>
                              {entry.clientName && (
                                <span className="inline-flex items-center gap-1 text-[#7B6F60]">
                                  <UserRound size={12} />
                                  {entry.clientName}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            {entry.title && (
                              <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-[#2E2520]">
                                {entry.title}
                              </h2>
                            )}

                            {/* Body text */}
                            <p className="mt-1.5 max-h-[112px] overflow-hidden whitespace-pre-wrap text-sm leading-[1.7] text-[#463A2F]">
                              {entry.text}
                            </p>

                            {/* Topic + tags */}
                            {(entry.topic || entry.tags.length > 0) && (
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {entry.topic && (
                                  <span className="rounded-full bg-[#E8EEF9] px-2 py-0.5 text-xs font-medium text-[#355E9C]">
                                    {entry.topic}
                                  </span>
                                )}
                                {entry.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs text-[#6B5D4F] ring-1 ring-[#D8CFBE]"
                                  >
                                    <Tag size={10} />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Context menu */}
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() =>
                                setOpenMenu(openMenu === entry.id ? null : entry.id)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[#9A8A72] hover:bg-[#F1E8D9]"
                              aria-label="Действия с записью"
                            >
                              <MoreVertical size={15} />
                            </button>

                            {openMenu === entry.id && (
                              <div className="absolute right-0 top-9 z-20 min-w-[220px] overflow-hidden rounded-xl border border-[#D8CFBE] bg-white shadow-xl">
                                <button
                                  onClick={() => openEdit(entry)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#3D3228] hover:bg-[#F7F3EA]"
                                >
                                  <Edit3 size={13} className="text-[#6B5D4F]" />
                                  Редактировать
                                </button>
                                <button
                                  onClick={() => openEdit(entry)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#3D3228] hover:bg-[#F7F3EA]"
                                >
                                  <UserRound size={13} className="text-[#6B5D4F]" />
                                  Связать с клиентом
                                </button>
                                <button
                                  onClick={() => addToMaterials(entry)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#3D3228] hover:bg-[#F7F3EA]"
                                >
                                  <FilePlus2 size={13} className="text-[#6B5D4F]" />
                                  Добавить в материалы клиента
                                </button>
                                <div className="mx-3 my-1 h-px bg-[#F0EBE3]" />
                                <button
                                  onClick={() => initiateDelete(entry.id)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#B42318] hover:bg-[#FEF3F2]"
                                >
                                  <Trash2 size={13} />
                                  Удалить
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Pagination ── */}
              <div className="mt-6 flex items-center justify-between border-t border-[#E2D8C8] pt-4">
                <button
                  onClick={() => goToPage(query.page - 1)}
                  disabled={query.page <= 1 || loading}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[#D8CFBE] bg-white/70 px-3 text-sm font-medium text-[#4D4034] hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Предыдущая
                </button>

                <span className="text-sm font-semibold text-[#6B5D4F]">
                  Страница {data.page} из {data.totalPages}
                </span>

                <button
                  onClick={() => goToPage(query.page + 1)}
                  disabled={query.page >= data.totalPages || loading}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[#D8CFBE] bg-white/70 px-3 text-sm font-medium text-[#4D4034] hover:bg-white disabled:opacity-40"
                >
                  Следующая
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create / Edit modal ── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D241C]/35 p-0 sm:items-center sm:p-6">
          <div className="notebook-paper max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] border border-[#CFC0A9] shadow-2xl sm:rounded-[26px]">
            {/* Modal binding strip — sticky so it stays visible while scrolling */}
            <div className="sticky top-0 z-10">
              <BindingStrip count={9} small />
            </div>
            <div className="p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9A8A72]">
                    {form.id ? "Редактирование" : "Новая запись"}
                  </p>
                  <h2 className="text-lg font-bold text-[#3D3228]">Лист блокнота</h2>
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F1E8D9]"
                  aria-label="Закрыть"
                >
                  <X size={18} className="text-[#6B5D4F]" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Заголовок — необязательно"
                  className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white/75 px-3 text-sm text-[#3D3228] outline-none focus:border-[#6088ff] focus:ring-2 focus:ring-[#6088ff]/10"
                />
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder="Текст записи"
                  rows={8}
                  className="w-full resize-none rounded-xl border border-[#D8CFBE] bg-white/75 px-3 py-3 text-sm leading-[1.7] text-[#3D3228] outline-none focus:border-[#6088ff] focus:ring-2 focus:ring-[#6088ff]/10"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={form.clientId}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                    className="h-11 rounded-xl border border-[#D8CFBE] bg-white/75 px-3 text-sm text-[#3D3228]"
                  >
                    <option value="">Связать с клиентом — необязательно</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    value={form.topic}
                    onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                    className="h-11 rounded-xl border border-[#D8CFBE] bg-white/75 px-3 text-sm text-[#3D3228]"
                  >
                    <option value="">Тема — необязательно</option>
                    {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <input
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="Теги через запятую: СДВГ, группа, обучение"
                  className="h-11 w-full rounded-xl border border-[#D8CFBE] bg-white/75 px-3 text-sm text-[#3D3228] outline-none focus:border-[#6088ff]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-[#D8CFBE] bg-white/75 px-4 py-2 text-sm font-medium text-[#4D4034] hover:bg-[#F5F0E6]"
                >
                  Отмена
                </button>
                <button
                  onClick={saveEntry}
                  disabled={!form.text.trim() || saving}
                  className="flex items-center gap-2 rounded-xl bg-[#4A3C2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A2E22] disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <DeleteConfirmDialog
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#CFC0A9] bg-white px-5 py-2.5 text-sm font-medium text-[#3D3228] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
