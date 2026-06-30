"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  FilePlus2,
  Filter,
  Loader2,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { NotebookEntry } from "@/lib/notebookStore";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

const TOPICS = [
  "Идея",
  "Напоминание",
  "Супервизия",
  "Методика",
  "Организационное",
  "Клиентская работа",
  "Другое",
];

const NOTEBOOK_FETCH_PAGE_SIZE = 500;
const NOTEBOOK_FALLBACK_ENTRIES_PER_PAGE = 3;

type SortMode  = "newest" | "oldest" | "updated" | "client" | "topic";
type GroupMode = "none" | "date" | "client" | "topic";
type DateMode  = "all" | "today" | "7d" | "30d" | "custom";
type NotebookView = "closed" | "open";
type NotebookToolSection = "search" | "filters" | "sorting" | "grouping";

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

interface NotebookPageEntry {
  entry: NotebookEntry;
  index: number;
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

const NOTEBOOK_TOOLS_STORAGE_KEY = "notebook_tools_open_sections";
const DEFAULT_TOOL_SECTIONS: NotebookToolSection[] = ["search", "filters", "sorting", "grouping"];

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

function groupKey(entry: NotebookEntry, group: GroupMode) {
  if (group === "date") return formatDateGroup(entry.createdAt);
  if (group === "client") return entry.clientId ?? "none";
  if (group === "topic") return entry.topic ?? "none";
  return "none";
}

function pageGroupTitle(entries: NotebookEntry[], group: GroupMode) {
  if (group === "none" || entries.length === 0) return "";
  const firstKey = groupKey(entries[0], group);
  const hasSingleGroup = entries.every((entry) => groupKey(entry, group) === firstKey);
  return hasSingleGroup ? groupTitle(entries[0], group) : "";
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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSearchMatches(text: string, search: string) {
  const terms = search.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return text.split(pattern).map((part, index) =>
    terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="notebook-search-highlight">
        {part}
      </mark>
    ) : (
      part
    ),
  );
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

function BindingSpine({ count = 12 }: { count?: number }) {
  return (
    <div className="notebook-spine" aria-hidden="true">
      <div className="notebook-spine-shadow" />
      <div className="notebook-rings">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="notebook-ring" />
        ))}
      </div>
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function NotebookPageStack() {
  return (
    <>
      <div className="notebook-closed-pages notebook-closed-pages-back" aria-hidden="true" />
      <div className="notebook-closed-pages notebook-closed-pages-middle" aria-hidden="true" />
    </>
  );
}

function NotebookCoverRings({ count = 10 }: { count?: number }) {
  return (
    <div className="notebook-cover-rings" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="notebook-cover-ring" />
      ))}
    </div>
  );
}

function NotebookCoverContent() {
  return (
    <div className="notebook-cover-content">
      <div className="notebook-cover-frame" aria-hidden="true" />
      <div className="notebook-cover-leaf notebook-cover-leaf-top" aria-hidden="true">⌁</div>
      <h2 className="notebook-cover-title">
        <span>Блокнот</span>
        <span>психолога</span>
      </h2>
      <div className="notebook-cover-divider" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="notebook-cover-illustration" aria-hidden="true">
        <div className="notebook-cover-plant" />
        <div className="notebook-cover-chair notebook-cover-chair-left" />
        <div className="notebook-cover-chair notebook-cover-chair-right" />
        <div className="notebook-cover-person notebook-cover-person-left" />
        <div className="notebook-cover-person notebook-cover-person-right" />
        <div className="notebook-cover-table" />
        <div className="notebook-cover-shelf" />
      </div>
      <p className="notebook-cover-caption">Заметки · размышления · инсайты</p>
      <div className="notebook-cover-leaf notebook-cover-leaf-bottom" aria-hidden="true">⌁</div>
    </div>
  );
}

function NotebookCover({
  isOpening,
  onOpen,
}: {
  isOpening: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`notebook-cover-stage ${isOpening ? "notebook-cover-stage-opening" : ""}`}
      onClick={onOpen}
      aria-label="Открыть блокнот психолога"
    >
      <div className="notebook-cover-stationary-bg" aria-hidden="true" />
      <div className="notebook-cover-object">
        <img
          src="/Bloknote Main 1.png"
          alt="Обложка блокнота психолога"
          className="notebook-cover-exact-image"
        />
      </div>
    </button>
  );
}

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
  const [sortOpen, setSortOpen]               = useState(false);
  const [groupOpen, setGroupOpen]             = useState(false);
  const [notebookView, setNotebookView]       = useState<NotebookView>("closed");
  const [notebookOpening, setNotebookOpening] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => new Set());
  const [toolSectionsOpen, setToolSectionsOpen] =
    useState<NotebookToolSection[]>(DEFAULT_TOOL_SECTIONS);
  const [reloadKey, setReloadKey]             = useState(0);
  const [deleteTarget, setDeleteTarget]       = useState<string | null>(null);
  const searchInputRef                         = useRef<HTMLInputElement>(null);
  const notebookTurnRef                        = useRef<HTMLDivElement>(null);
  const measureEntryRefs                       = useRef<Map<string, HTMLElement>>(new Map());
  const [notebookTurnHeight, setNotebookTurnHeight] = useState(0);
  const [notebookPages, setNotebookPages]      = useState<NotebookPageEntry[][]>([]);

  useEffect(() => { setQuery(readInitialQuery()); }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTEBOOK_TOOLS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter((item): item is NotebookToolSection =>
        DEFAULT_TOOL_SECTIONS.includes(item),
      );
      if (valid.length) setToolSectionsOpen(valid);
    } catch {
      setToolSectionsOpen(DEFAULT_TOOL_SECTIONS);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(NOTEBOOK_TOOLS_STORAGE_KEY, JSON.stringify(toolSectionsOpen));
  }, [toolSectionsOpen]);

  useEffect(() => {
    const element = notebookTurnRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = Math.floor(element.getBoundingClientRect().height);
      setNotebookTurnHeight((prev) => (Math.abs(prev - nextHeight) > 2 ? nextHeight : prev));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [notebookView]);

  useEffect(() => {
    if (!data.entries.length) {
      setNotebookPages([]);
      return;
    }

    const fallbackPages: NotebookPageEntry[][] = [];
    data.entries.forEach((entry, index) => {
      const pageIndex = Math.floor(index / NOTEBOOK_FALLBACK_ENTRIES_PER_PAGE);
      if (!fallbackPages[pageIndex]) fallbackPages[pageIndex] = [];
      fallbackPages[pageIndex].push({ entry, index });
    });

    if (!notebookTurnHeight) {
      setNotebookPages(fallbackPages);
      return;
    }

    const nextPages: NotebookPageEntry[][] = [];
    let currentPage: NotebookPageEntry[] = [];
    let usedHeight = 0;
    const pageHeight = Math.max(120, notebookTurnHeight - 2);

    data.entries.forEach((entry, index) => {
      const measured = measureEntryRefs.current.get(entry.id);
      const entryHeight = Math.ceil(measured?.getBoundingClientRect().height ?? 160);
      if (currentPage.length > 0 && usedHeight + entryHeight > pageHeight) {
        nextPages.push(currentPage);
        currentPage = [];
        usedHeight = 0;
      }
      currentPage.push({ entry, index });
      usedHeight += entryHeight;
    });

    if (currentPage.length) nextPages.push(currentPage);
    setNotebookPages(nextPages.length ? nextPages : fallbackPages);
  }, [data.entries, expandedEntries, notebookTurnHeight, query.group]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(query.search), 300);
    return () => window.clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    if (!query.search.trim() || notebookView !== "closed") return;
    setNotebookView("open");
    setNotebookOpening(false);
  }, [notebookView, query.search]);

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
    sp.set("page", "1");
    sp.set("pageSize", String(NOTEBOOK_FETCH_PAGE_SIZE));
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
          setData({ entries: [], page: query.page, pageSize: NOTEBOOK_FETCH_PAGE_SIZE, total: 0, totalPages: 1 });
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

  function buildNotebookParams(nextQuery: QueryState, page: number) {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(NOTEBOOK_FETCH_PAGE_SIZE));
    if (nextQuery.search) sp.set("search", nextQuery.search);
    if (nextQuery.client) sp.set("client", nextQuery.client);
    if (nextQuery.topic) sp.set("topic", nextQuery.topic);
    if (nextQuery.tags) sp.set("tags", nextQuery.tags);
    if (nextQuery.sort) sp.set("sort", nextQuery.sort);
    if (nextQuery.group) sp.set("group", nextQuery.group);
    if (nextQuery.date) sp.set("date", nextQuery.date);
    if (nextQuery.from) sp.set("from", nextQuery.from);
    if (nextQuery.to) sp.set("to", nextQuery.to);
    return sp;
  }

  async function findEntryPage(entryId: string, nextQuery: QueryState) {
    const firstRes = await fetch(`/api/notebook?${buildNotebookParams(nextQuery, 1).toString()}`);
    if (!firstRes.ok) return null;
    const firstPage = await firstRes.json() as NotebookResponse;
    if (firstPage.entries.some((entry) => entry.id === entryId)) return 1;

    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const res = await fetch(`/api/notebook?${buildNotebookParams(nextQuery, page).toString()}`);
      if (!res.ok) return null;
      const pageData = await res.json() as NotebookResponse;
      if (pageData.entries.some((entry) => entry.id === entryId)) return page;
    }

    return null;
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
      const savedEntry = await res.json() as NotebookEntry;
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
        const fallbackQuery: QueryState = {
          ...query,
          page: 1,
          search: "",
          client: "",
          topic: "",
          tags: "",
          date: "all",
          from: "",
          to: "",
        };
        const currentPage = await findEntryPage(savedEntry.id, { ...query, page: 1 });
        const nextQuery = currentPage
          ? { ...query, page: currentPage }
          : { ...fallbackQuery, page: await findEntryPage(savedEntry.id, fallbackQuery) ?? 1 };
        setQuery(nextQuery);
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
    if (visibleEntries.length === 1 && query.page > 1) {
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

  function toggleEntryExpanded(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > notebookTotalPages || nextPage === query.page) return;
    setTurnDirection(nextPage > query.page ? "next" : "prev");
    updateQuery({ page: nextPage }, false);
    window.setTimeout(() => setTurnDirection("none"), 360);
  }

  function openNotebook() {
    if (notebookOpening) return;
    setNotebookOpening(true);
    window.setTimeout(() => {
      setNotebookView("open");
      setNotebookOpening(false);
    }, 430);
  }

  function closeNotebook() {
    if (query.search) {
      setDebouncedSearch("");
      updateQuery({ search: "" });
    }
    setNotebookView("closed");
    setOpenMenu(null);
  }

  function resetFilters() {
    updateQuery({
      search: "", client: "", topic: "", tags: "",
      date: "all", from: "", to: "", group: "none", sort: "newest",
    });
    setFiltersOpen(false);
  }

  function isToolSectionOpen(section: NotebookToolSection) {
    return toolSectionsOpen.includes(section);
  }

  function toggleToolSection(section: NotebookToolSection) {
    setToolSectionsOpen((prev) =>
      prev.includes(section)
        ? prev.filter((item) => item !== section)
        : [...prev, section],
    );
  }

  function handleSearchChange(value: string) {
    updateQuery({ search: value });
    setDebouncedSearch(value);
    if (value.trim()) {
      setNotebookView("open");
      setNotebookOpening(false);
    }
  }

  function submitSearch(value = query.search) {
    setDebouncedSearch(value);
    updateQuery({ search: value });
    setNotebookView("open");
    setNotebookOpening(false);
  }

  const notebookTotalPages = Math.max(1, notebookPages.length || data.totalPages);
  const currentPageEntries = notebookPages[query.page - 1] ?? [];
  const visibleEntries = currentPageEntries.map((item) => item.entry);
  const isFiltered = activeFilters > 0 || !!query.search;
  const heading = pageGroupTitle(visibleEntries, query.group);

  useEffect(() => {
    if (query.page > notebookTotalPages) {
      updateQuery({ page: notebookTotalPages }, false);
    }
  }, [notebookTotalPages, query.page]);

  return (
    <div className="flex-1 h-full min-h-0 overflow-hidden bg-[#F7F3EA]">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col overflow-visible px-4 py-6 sm:px-8 sm:py-8">

        {/* ── Page header ── */}
        <div className="notebook-layout">
        <section className="notebook-main-column">
        <div className="notebook-top-zone">
          <div className="notebook-header-row">
          <div className="notebook-heading">
            <div className="notebook-heading-icon">
              <BookOpen size={18} className="text-[#6B5D4F]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#3D3228]">Блокнот психолога</h1>
              <p className="whitespace-nowrap text-sm text-[#8F7F69]">Личные записи, идеи, мысли...</p>
            </div>
          </div>

            <button
              type="button"
              onClick={openNewEntry}
              className="notebook-primary-action"
            >
              <Plus size={15} />
              Новая запись
            </button>
          </div>

          <div className="notebook-toolbar">
            {/* Search */}
            <div className="notebook-search-control">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8A72]" />
              <input
                value={query.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch(e.currentTarget.value);
                }}
                placeholder="Поиск по тексту, клиенту, теме, тегам"
                className="notebook-toolbar-input pl-9 pr-3"
              />
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`notebook-toolbar-button ${
                filtersOpen || activeFilters > 0
                  ? "border-[#6088ff] bg-[#EEF2FF] text-[#355E9C]"
                  : "border-[#D8CFBE] bg-white/80 text-[#4D4034] hover:bg-white"
              }`}
            >
              <Filter size={15} />
              Фильтры{activeFilters > 0 ? ` · ${activeFilters}` : ""}
            </button>

            {/* Sort */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className={`notebook-toolbar-button notebook-sort-button ${
                  sortOpen
                    ? "border-[#6088ff] bg-white text-[#3D3228]"
                    : "border-[#D8CFBE] bg-white/80 text-[#4D4034] hover:bg-white"
                }`}
              >
                Сортировка
                <ChevronDown size={15} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-[#D8CFBE] bg-white shadow-xl">
                  {[
                    ["newest", "Нет"],
                    ["oldest", "Сначала старые"],
                    ["updated", "Недавно изменённые"],
                    ["client", "По клиенту"],
                    ["topic", "По теме"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        updateQuery({ sort: value as SortMode });
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-[#F7F3EA] ${
                        query.sort === value ? "font-semibold text-[#355E9C]" : "text-[#4D4034]"
                      }`}
                    >
                      {label}
                      {query.sort === value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Group */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGroupOpen((v) => !v)}
                className={`notebook-toolbar-button notebook-sort-button ${
                  groupOpen
                    ? "border-[#6088ff] bg-white text-[#3D3228]"
                    : "border-[#D8CFBE] bg-white/80 text-[#4D4034] hover:bg-white"
                }`}
              >
                Группировка
                <ChevronDown size={15} />
              </button>
              {groupOpen && (
                <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-[#D8CFBE] bg-white shadow-xl">
                  {[
                    ["none", "Нет"],
                    ["date", "По дате"],
                    ["client", "По клиенту"],
                    ["topic", "По теме"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        updateQuery({ group: value as GroupMode });
                        setGroupOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-[#F7F3EA] ${
                        query.group === value ? "font-semibold text-[#355E9C]" : "text-[#4D4034]"
                      }`}
                    >
                      {label}
                      {query.group === value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Filter panel ── */}
        {filtersOpen && (
          <div className="notebook-filter-panel grid gap-3 rounded-2xl border border-[#D8CFBE] bg-[#FBF8F2] p-4 shadow-sm md:grid-cols-5">
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
        <div className={`notebook-vertical-wrap ${notebookView === "open" ? "notebook-vertical-wrap-open" : ""}`}>
          {notebookView === "closed" ? (
            <NotebookCover isOpening={notebookOpening} onOpen={openNotebook} />
          ) : (
            <>
          {/* Back pages: subtle stacked sheets adapted to vertical format */}
          <div className="notebook-back-page notebook-back-page-a" />
          <div className="notebook-back-page notebook-back-page-b" />

          {/* Main vertical notebook */}
          <div className="notebook-shell">
            <BindingSpine count={12} />

            {/* Paper page */}
            <div className="notebook-paper notebook-page">
              {/* Red margin line inside paper, after the spine */}
              <div className="notebook-margin-line hidden sm:block" />

              {/* Paper content area */}
              <div className="notebook-page-content">

              {/* Inner notebook header */}
              <div className="notebook-inner-header mb-5 flex items-center justify-between gap-3 pb-4">
                <div>
                  <p className="notebook-inner-title font-bold uppercase text-[#9A8A72]">
                    Личный блокнот{" "}
                    <span className="notebook-inner-count font-semibold italic normal-case tracking-normal text-[#6B5D4F]">
                      ({pluralNotes(data.total)})
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
              </div>

              {/* Group heading */}
              {heading && (
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D8CFBE] bg-white/70 px-3 py-1">
                    <span className="text-xs font-semibold text-[#6B5D4F]">{heading}</span>
                    <span className="text-[10px] text-[#9A8A72]">·</span>
                    <span className="text-xs text-[#9A8A72]">
                      {pluralNotes(visibleEntries.length)} на этой странице
                    </span>
                  </div>
                </div>
              )}

              {/* Entry list with page-turn animation wrapper */}
              <div
                ref={notebookTurnRef}
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
                ) : visibleEntries.length === 0 ? (
                  /* ── Empty state ── */
                  <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-[#C6B69B] bg-[#F1E9DC]">
                      <BookOpen size={28} className="text-[#B0997D]" />
                    </div>
                    <p className="text-base font-semibold text-[#3D3228]">
                      {isFiltered ? "Таких записей нет" : "Ваш блокнот пока пуст"}
                    </p>
                    <p className="mt-2 max-w-xs text-sm text-[#8F7F69]">
                      {isFiltered
                        ? "Попробуйте изменить поиск или сбросить фильтры."
                        : "Создайте первую запись — мысль, идею, наблюдение или напоминание."}
                    </p>
                    <button
                      onClick={isFiltered ? resetFilters : openNewEntry}
                      className="mt-5 flex items-center gap-2 rounded-xl bg-[#503C27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#463520]"
                    >
                      {isFiltered ? <X size={14} /> : <Plus size={14} />}
                      {isFiltered ? "Сбросить фильтры" : "+ Новая запись"}
                    </button>
                  </div>
                ) : (
                  /* ── Entries ── */
                  <div className="divide-y divide-dashed divide-[#D9CDB9]">
                    {currentPageEntries.map(({ entry, index }) => {
                      const isExpanded = expandedEntries.has(entry.id);
                      const canExpand = entry.text.length > 260 || entry.text.split(/\r?\n/).length > 4;
                      const entryNumber = index + 1;

                      return (
                      <article key={entry.id} className="py-4 first:pt-0 last:pb-1">
                        <div className="flex flex-wrap items-start gap-x-2 gap-y-0">
                          <span className="notebook-entry-number" aria-label={`Запись номер ${entryNumber}`}>
                            {entryNumber}
                          </span>
                          <div className="notebook-entry-main min-w-0 flex-1">
                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9A8A72]">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays size={12} />
                                {formatDate(entry.createdAt)}
                              </span>
                              {entry.clientName && (
                                <span className="inline-flex items-center gap-1.5 text-[#7B6F60]">
                                  <Avatar
                                    initials={entry.clientInitials ?? initialsFromName(entry.clientName)}
                                    color={entry.clientColor ?? "#6088ff"}
                                    size="xs"
                                  />
                                  {entry.clientName}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            {entry.title && (
                              <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-[#2E2520]">
                                {highlightSearchMatches(entry.title, query.search)}
                              </h2>
                            )}

                            {/* Body text */}
                            <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-[1.7] text-[#463A2F] ${!isExpanded && canExpand ? "max-h-[112px] overflow-hidden" : ""}`}>
                              {highlightSearchMatches(entry.text, query.search)}
                            </p>

                            {canExpand && (
                              <button
                                onClick={() => toggleEntryExpanded(entry.id)}
                                className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#D8CFBE] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#6B5D4F] hover:bg-[#F7F3EA]"
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isExpanded ? "Свернуть" : "Показать полностью"}
                              </button>
                            )}

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
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Pagination ── */}
              <div className="notebook-measure-list" aria-hidden="true">
                {data.entries.map((entry, index) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  const canExpand = entry.text.length > 260 || entry.text.split(/\r?\n/).length > 4;

                  return (
                    <article
                      key={entry.id}
                      ref={(node) => {
                        if (node) measureEntryRefs.current.set(entry.id, node);
                        else measureEntryRefs.current.delete(entry.id);
                      }}
                      className="py-4 first:pt-0 last:pb-1"
                    >
                      <div className="flex items-start gap-3">
                        <span className="notebook-entry-number">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9A8A72]">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={12} />
                              {formatDate(entry.createdAt)}
                            </span>
                            {entry.clientName && (
                              <span className="inline-flex items-center gap-1.5 text-[#7B6F60]">
                                <Avatar
                                  initials={entry.clientInitials ?? initialsFromName(entry.clientName)}
                                  color={entry.clientColor ?? "#6088ff"}
                                  size="xs"
                                />
                                {entry.clientName}
                              </span>
                            )}
                          </div>
                          {entry.title && (
                            <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-[#2E2520]">
                              {entry.title}
                            </h2>
                          )}
                          <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-[1.7] text-[#463A2F] ${!isExpanded && canExpand ? "max-h-[112px] overflow-hidden" : ""}`}>
                            {entry.text}
                          </p>
                          {canExpand && (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#D8CFBE] bg-white/70 px-2.5 py-1 text-xs font-medium text-[#6B5D4F]">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isExpanded ? "Свернуть" : "Показать полностью"}
                            </div>
                          )}
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
                        <div className="h-8 w-8 flex-shrink-0" />
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="notebook-pagination">
                <button
                  type="button"
                  onClick={() => goToPage(1)}
                  disabled={query.page <= 1 || loading}
                  className="notebook-pagination-button notebook-pagination-button-icon"
                  aria-label="В начало"
                  title="В начало"
                >
                  <ChevronsLeft size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => goToPage(query.page - 1)}
                  disabled={query.page <= 1 || loading}
                  className="notebook-pagination-button"
                >
                  <ChevronLeft size={15} />
                  Предыдущая
                </button>

                <span className="text-sm font-semibold text-[#6B5D4F]">
                  Страница {query.page} из {notebookTotalPages}
                </span>

                <button
                  type="button"
                  onClick={closeNotebook}
                  className="notebook-cover-button"
                  aria-label="Закрыть блокнот"
                  title="Закрыть блокнот"
                >
                  <BookOpen size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => goToPage(query.page + 1)}
                  disabled={query.page >= notebookTotalPages || loading}
                  className="notebook-pagination-button"
                >
                  Следующая
                  <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => goToPage(notebookTotalPages)}
                  disabled={query.page >= notebookTotalPages || loading}
                  className="notebook-pagination-button notebook-pagination-button-icon"
                  aria-label="В конец"
                  title="В конец"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>

          </div>
          </div>
            </>
          )}
        </div>
        </section>

        <aside className="notebook-control-sidebar" aria-label="Инструменты блокнота">
          <section className="notebook-control-card notebook-search-card">
            <span className="notebook-control-title">
              <Search size={16} />
              <span>Поиск</span>
            </span>
            <div className="notebook-control-search">
              <input
                value={query.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch(e.currentTarget.value);
                }}
                placeholder="ПОИСК"
                aria-label="Поиск по записям"
              />
              {query.search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="notebook-control-search-clear"
                  aria-label="Очистить поиск"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </section>

          <section className="notebook-control-card">
            <button
              type="button"
              onClick={() => toggleToolSection("filters")}
              className="notebook-control-card-toggle"
            >
              <span className="notebook-control-title">
                <Filter size={16} />
                <span>Фильтры{activeFilters > 0 ? ` · ${activeFilters}` : ""}</span>
              </span>
              <ChevronDown size={16} className={isToolSectionOpen("filters") ? "rotate-180" : ""} />
            </button>
            {isToolSectionOpen("filters") && (
              <div className="notebook-control-content">
                <label className="notebook-control-row">
                  <span>Клиент</span>
                  <select value={query.client} onChange={(e) => updateQuery({ client: e.target.value })}>
                    <option value="">Все записи</option>
                    <option value="none">Без клиента</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="notebook-control-row">
                  <span>Тема</span>
                  <select value={query.topic} onChange={(e) => updateQuery({ topic: e.target.value })}>
                    <option value="">Все темы</option>
                    {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="notebook-control-row">
                  <span>Дата</span>
                  <select value={query.date} onChange={(e) => updateQuery({ date: e.target.value as DateMode })}>
                    <option value="all">За все время</option>
                    <option value="today">Сегодня</option>
                    <option value="7d">7 дней</option>
                    <option value="30d">30 дней</option>
                    <option value="custom">Период</option>
                  </select>
                </label>
                {query.date === "custom" && (
                  <div className="notebook-control-date-row">
                    <input type="date" value={query.from} onChange={(e) => updateQuery({ from: e.target.value })} />
                    <input type="date" value={query.to} onChange={(e) => updateQuery({ to: e.target.value })} />
                  </div>
                )}
                <label className="notebook-control-row">
                  <span>Теги</span>
                  <input value={query.tags} onChange={(e) => updateQuery({ tags: e.target.value })} placeholder="Все теги" />
                </label>
                <button type="button" onClick={resetFilters} className="notebook-control-reset">
                  Сбросить
                </button>
              </div>
            )}
          </section>

          <section className="notebook-control-card">
            <button
              type="button"
              onClick={() => toggleToolSection("sorting")}
              className="notebook-control-card-toggle"
            >
              <span className="notebook-control-title">
                <ArrowUpDown size={16} />
                <span>Сортировка</span>
              </span>
              <ChevronDown size={16} className={isToolSectionOpen("sorting") ? "rotate-180" : ""} />
            </button>
            {isToolSectionOpen("sorting") && (
              <div className="notebook-control-content">
                {[
                  ["newest", "Сначала новые"],
                  ["oldest", "Сначала старые"],
                  ["updated", "Недавно измененные"],
                  ["client", "По клиенту"],
                  ["topic", "По теме"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateQuery({ sort: value as SortMode })}
                    className={`notebook-control-option ${query.sort === value ? "notebook-control-option-active" : ""}`}
                  >
                    <span>{label}</span>
                    {query.sort === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="notebook-control-card">
            <button
              type="button"
              onClick={() => toggleToolSection("grouping")}
              className="notebook-control-card-toggle"
            >
              <span className="notebook-control-title">
                <Layers size={16} />
                <span>Группировка</span>
              </span>
              <ChevronDown size={16} className={isToolSectionOpen("grouping") ? "rotate-180" : ""} />
            </button>
            {isToolSectionOpen("grouping") && (
              <div className="notebook-control-content">
                {[
                  ["none", "Без группировки"],
                  ["date", "По дате"],
                  ["client", "По клиенту"],
                  ["topic", "По теме"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateQuery({ group: value as GroupMode })}
                    className={`notebook-control-option ${query.group === value ? "notebook-control-option-active" : ""}`}
                  >
                    <span>{label}</span>
                    {query.group === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
        </div>
      </div>

      {/* ── Create / Edit modal ── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D241C]/35 p-0 sm:items-center sm:p-6">
          <div className="notebook-paper notebook-entry-modal">
            {/* Modal binding strip — sticky so it stays visible while scrolling */}
            <div className="sticky top-0 z-10">
              <BindingStrip count={9} small />
            </div>
            <div className="notebook-entry-modal-body">
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

              <div className="notebook-entry-form">
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
                  rows={12}
                  className="w-full resize-none rounded-xl border border-[#D8CFBE] bg-white/75 px-3 py-3 text-sm leading-[1.7] text-[#3D3228] outline-none focus:border-[#6088ff] focus:ring-2 focus:ring-[#6088ff]/10"
                />
                <div className="notebook-entry-meta">
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

              <div className="notebook-entry-actions">
                <button
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-[#D8CFBE] bg-white/75 px-4 py-2 text-sm font-medium text-[#4D4034] hover:bg-[#F5F0E6]"
                >
                  Отмена
                </button>
                <button
                  onClick={saveEntry}
                  disabled={!form.text.trim() || saving}
                  className="flex items-center gap-2 rounded-xl bg-[#503C27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#463520] disabled:opacity-40"
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
