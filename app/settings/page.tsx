"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Save, Trash2, User, CheckCircle2, AlertCircle,
  BrainCircuit, Database, Loader2, Camera, X, ArrowLeft,
  Building2, ChevronDown, RotateCcw, BookOpen, Mic,
} from "lucide-react";
import type { UserProfile, AnalysisStyle, AnalysisLength, ChatStyle } from "@/lib/userProfile";
import { AI_MODELS, ANALYSIS_STYLE_OPTIONS, ANALYSIS_LENGTH_OPTIONS, CHAT_STYLE_OPTIONS } from "@/lib/userProfile";
import {
  type CityAnimationSettings,
  type CityIntensity,
  type CharacterFrequency,
  type EasterEggFrequency,
  DEFAULT_CITY_ANIMATION_SETTINGS,
  CITY_ANIM_STORAGE_KEY,
} from "@/lib/city-animation/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY: UserProfile = {
  firstName:           "",
  lastName:            "",
  displayName:         "",
  specialization:      "",
  approach:            "",
  email:               "",
  defaultAnalysisMode: "working",
  photoUrl:            "",
  aiModel:             "gpt-4o",
  analysisStyle:       "professional",
  analysisLength:      "standard",
  chatStyle:           "normal",
  aiInstructions:      "",
};

const AI_DEFAULTS = {
  aiModel:        "gpt-4o",
  analysisStyle:  "professional"  as AnalysisStyle,
  analysisLength: "standard"      as AnalysisLength,
  chatStyle:      "normal"        as ChatStyle,
  aiInstructions: "",
};

const APPROACHES = ["Гештальт", "КПТ", "ACT", "Схема-терапия", "Интегративный", "Другой"];

type SectionId = "profile" | "ai" | "interface" | "transcription" | "data";

const VALID_SECTION_IDS: SectionId[] = ["profile", "ai", "interface", "transcription", "data"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolve section from URL (?section=profile)
  const rawSection = searchParams.get("section");
  const targetSection = (rawSection && VALID_SECTION_IDS.includes(rawSection as SectionId))
    ? (rawSection as SectionId)
    : null;

  // Profile state
  const [profile, setProfile] = useState<UserProfile>(EMPTY);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);

  // City animation state
  const [cityAnim, setCityAnim] = useState<CityAnimationSettings>(DEFAULT_CITY_ANIMATION_SETTINGS);
  const [animSaveStatus, setAnimSaveStatus] = useState<"idle" | "saved">("idle");
  const saveAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // API check state
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [apiMasked, setApiMasked]         = useState<string | null>(null);
  const [checkingApi, setCheckingApi]     = useState(false);
  const [checkResult, setCheckResult]     = useState("");

  // Accordion: open target section on load, rest collapsed
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set<SectionId>(targetSection ? [targetSection] : [])
  );
  const isOpen = (id: SectionId) => openSections.has(id);
  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Scroll to the target section after mount
  const targetSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!targetSection) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targetSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load city animation from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CITY_ANIM_STORAGE_KEY);
      if (raw) {
        setCityAnim({ ...DEFAULT_CITY_ANIMATION_SETTINGS, ...JSON.parse(raw) });
      } else {
        const legacy = localStorage.getItem("cityAnimation");
        if (legacy !== null) setCityAnim((p) => ({ ...p, animationEnabled: legacy !== "false" }));
      }
    } catch {}
  }, []);

  const saveAnimSettings = useCallback((next: CityAnimationSettings) => {
    const json = JSON.stringify(next);
    localStorage.setItem(CITY_ANIM_STORAGE_KEY, json);
    window.dispatchEvent(new StorageEvent("storage", { key: CITY_ANIM_STORAGE_KEY, newValue: json }));
    if (saveAnimTimer.current) clearTimeout(saveAnimTimer.current);
    setAnimSaveStatus("saved");
    saveAnimTimer.current = setTimeout(() => setAnimSaveStatus("idle"), 2000);
  }, []);

  function updateAnim<K extends keyof CityAnimationSettings>(key: K, val: CityAnimationSettings[K]) {
    const next = { ...cityAnim, [key]: val };
    setCityAnim(next);
    saveAnimSettings(next);
  }

  function resetAnimSettings() {
    setCityAnim(DEFAULT_CITY_ANIMATION_SETTINGS);
    saveAnimSettings(DEFAULT_CITY_ANIMATION_SETTINGS);
  }

  // Load profile + API status on mount
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setProfile({ ...EMPTY, ...data }))
      .catch(() => {});

    fetch("/api/check-connection")
      .then((r) => r.json())
      .then((d) => { setApiConfigured(d.configured); setApiMasked(d.masked ?? null); })
      .catch(() => setApiConfigured(false));
  }, []);

  // Profile field setter
  function setField(field: keyof UserProfile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (saveStatus === "saved") setSaveStatus("idle");
  }

  async function handleSave() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(profile),
      });
      if (!res.ok) throw new Error();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxSize = 200;
        const scale   = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setProfile((p) => ({ ...p, photoUrl: canvas.toDataURL("image/jpeg", 0.85) }));
        if (saveStatus === "saved") setSaveStatus("idle");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleDeleteProfile() {
    if (!confirm("Очистить профиль? Имя и специализация вернутся к значениям по умолчанию.")) return;
    setDeleting(true);
    try {
      await fetch("/api/profile", { method: "DELETE" });
      setProfile(EMPTY);
      setSaveStatus("idle");
    } finally {
      setDeleting(false);
    }
  }

  function handleAIReset(confirmed: boolean) {
    if (!confirmed) return;
    setProfile((p) => ({ ...p, ...AI_DEFAULTS }));
    if (saveStatus === "saved") setSaveStatus("idle");
  }

  async function handleCheckApi() {
    setCheckingApi(true);
    setCheckResult("");
    try {
      const res  = await fetch("/api/check-connection", { method: "POST" });
      const data = await res.json();
      setCheckResult(data.ok ? "✓ Подключение работает" : `✗ ${data.error ?? "Ошибка"}`);
      if (data.configured !== undefined) setApiConfigured(data.configured);
      if (data.masked) setApiMasked(data.masked);
    } catch {
      setCheckResult("✗ Ошибка проверки");
    } finally {
      setCheckingApi(false);
    }
  }

  // Derived AI summary for the closed section header
  const aiSummary = [
    AI_MODELS.find((m) => m.value === (profile.aiModel ?? "gpt-4o"))?.label ?? "GPT-4o",
    ANALYSIS_STYLE_OPTIONS.find((o) => o.value === (profile.analysisStyle ?? "professional"))?.label ?? "Профессиональный",
    ANALYSIS_LENGTH_OPTIONS.find((o) => o.value === (profile.analysisLength ?? "standard"))?.label ?? "Стандартный",
  ].join(" · ");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#A8997F" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#4A3C2E")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#A8997F")}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
          <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>Настройки</h1>
        </div>

        {/* Sections */}
        <div className="space-y-2">

          {/* 1. Profile */}
          <div ref={targetSection === "profile" ? targetSectionRef : undefined}>
          <SettingsSection
            title="Профиль"
            description="Имя и специализация, отображаются в боковой панели"
            icon={<User size={14} />}
            isOpen={isOpen("profile")}
            onToggle={() => toggleSection("profile")}
          >
            <div className="space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt="Фото" className="w-14 h-14 rounded-full object-cover border-2 border-slate-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-base font-bold border-2 border-slate-100" style={{ background: "#6B5D4F" }}>
                      {profile.firstName?.[0]?.toUpperCase() || "П"}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:bg-slate-50" style={{ borderColor: "#D4C9B5", color: "#6B5D4F" }}>
                      <Camera size={12} />
                      {profile.photoUrl ? "Сменить" : "Загрузить фото"}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                    {profile.photoUrl && (
                      <button
                        onClick={() => setProfile((p) => ({ ...p, photoUrl: "" }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs text-rose-400 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                        style={{ borderColor: "#D4C9B5" }}
                      >
                        <X size={11} /> Удалить
                      </button>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#A8997F" }}>JPG, PNG</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Имя" value={profile.firstName} onChange={(v) => setField("firstName", v)} placeholder="Наталья" />
                <Field label="Фамилия" value={profile.lastName} onChange={(v) => setField("lastName", v)} placeholder="Веселова" />
              </div>
              <Field
                label="Отображаемое имя"
                value={profile.displayName}
                onChange={(v) => setField("displayName", v)}
                placeholder="Наталья В. — если пусто, используется Имя + Фамилия"
              />
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B5D4F" }}>Подход</label>
                <select
                  value={profile.approach ?? ""}
                  onChange={(e) => setField("approach", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                  style={{ borderColor: "#D4C9B5", color: "#3D3228" }}
                >
                  <option value="">— Выберите подход —</option>
                  {APPROACHES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <Field
                label="Специализация"
                value={profile.specialization}
                onChange={(v) => setField("specialization", v)}
                placeholder="Гештальт-терапевт, работа с тревогой..."
              />
              <Field
                label="Email"
                value={profile.email ?? ""}
                onChange={(v) => setField("email", v)}
                placeholder="you@example.com"
                type="email"
              />

              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#E5DDD2" }}>
                <button
                  onClick={handleDeleteProfile}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} /> Очистить профиль
                </button>
                <SaveRow status={saveStatus} onSave={handleSave} />
              </div>
            </div>
          </SettingsSection>
          </div>

          {/* 2. AI Settings */}
          <SettingsSection
            title="Настройки AI"
            description={aiSummary}
            icon={<BrainCircuit size={14} />}
            isOpen={isOpen("ai")}
            onToggle={() => toggleSection("ai")}
          >
            <AISettingsContent
              profile={profile}
              saveStatus={saveStatus}
              onField={setField}
              onSave={handleSave}
              onReset={handleAIReset}
            />
          </SettingsSection>

          {/* 3. Interface */}
          <SettingsSection
            title="Интерфейс"
            description="Анимация города на главной странице"
            icon={<Building2 size={14} />}
            isOpen={isOpen("interface")}
            onToggle={() => toggleSection("interface")}
          >
            <CityAnimContent
              settings={cityAnim}
              saveStatus={animSaveStatus}
              onChange={updateAnim}
              onReset={resetAnimSettings}
              onSave={() => saveAnimSettings(cityAnim)}
            />
          </SettingsSection>

          {/* 4. Transcription */}
          <SettingsSection
            title="Транскрибация"
            description="Распознавание речи через OpenAI Whisper"
            icon={<Mic size={14} />}
            isOpen={isOpen("transcription")}
            onToggle={() => toggleSection("transcription")}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#F0EBE3" }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: "#4A3C2E" }}>OpenAI API</div>
                  {apiConfigured === null && <div className="text-xs" style={{ color: "#A8997F" }}>Проверка...</div>}
                  {apiConfigured === true && (
                    <div className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Настроен{apiMasked ? ` · ${apiMasked}` : ""}
                    </div>
                  )}
                  {apiConfigured === false && (
                    <div className="text-xs text-rose-500 flex items-center gap-1">
                      <AlertCircle size={11} /> Не настроен — установите OPENAI_API_KEY в Railway Variables
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCheckApi}
                  disabled={checkingApi}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-60"
                  style={{ borderColor: "#D4C9B5", color: "#6B5D4F", background: "#F7F4EF" }}
                >
                  {checkingApi ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Проверить
                </button>
              </div>
              {checkResult && (
                <div className={`text-sm px-3 py-2 rounded-xl ${checkResult.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {checkResult}
                </div>
              )}
              <div className="space-y-2.5">
                {[
                  ["Движок", "whisper-1"],
                  ["Язык", "Русский (фиксировано)"],
                  ["Форматы", "mp3, m4a, wav"],
                  ["Сжатие", "FFmpeg, 16 kHz mono"],
                  ["Лимит", "до 25 MB после сжатия"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span style={{ color: "#A8997F" }}>{k}</span>
                    <span style={{ color: "#4A3C2E" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* 6. Data */}
          <SettingsSection
            title="Данные"
            description="Экспорт и резервное копирование"
            icon={<Database size={14} />}
            isOpen={isOpen("data")}
            onToggle={() => toggleSection("data")}
          >
            <div className="grid grid-cols-2 gap-2">
              {["Экспорт клиентов", "Экспорт консультаций", "История клиентов", "Резервная копия"].map((label) => (
                <button
                  key={label}
                  disabled
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm cursor-not-allowed"
                  style={{ borderColor: "#E5DDD2", color: "#A8997F", background: "#F0EBE3" }}
                >
                  <span>{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E5DDD2", color: "#A8997F" }}>скоро</span>
                </button>
              ))}
            </div>
          </SettingsSection>

        </div>
      </div>
    </div>
  );
}

// ── SettingsSection ───────────────────────────────────────────────────────────

function SettingsSection({ title, description, icon, isOpen, onToggle, children }: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F7F4EF", borderColor: "#E5DDD2" }}>
      <button
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
        style={{
          background: isOpen ? "#EDE7DA" : "#F0EBE3",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#E5DDD2", color: "#6B5D4F" }}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "#4A3C2E" }}>{title}</div>
            {description && (
              <div className="text-xs truncate mt-0.5" style={{ color: "#A8997F" }}>{description}</div>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className="flex-shrink-0 ml-3"
          style={{
            color: "#A8997F",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {isOpen && (
        <div className="px-6 py-5 border-t" style={{ borderColor: "#E5DDD2" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── SaveRow ───────────────────────────────────────────────────────────────────

function SaveRow({ status, onSave, label = "Сохранить" }: {
  status: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Сохранено</span>}
      {status === "error"  && <span className="flex items-center gap-1 text-xs text-rose-500"><AlertCircle size={13} />Ошибка</span>}
      <button
        onClick={onSave}
        disabled={status === "saving"}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
        style={{ background: "#6B5D4F" }}
      >
        <Save size={13} />
        {status === "saving" ? "Сохранение..." : label}
      </button>
    </div>
  );
}

// ── AISettingsContent ─────────────────────────────────────────────────────────

function SegButtons<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.hint}
            className="px-4 py-2 rounded-xl border text-sm transition-all"
            style={{
              background:    active ? "#EDE7DA" : "#F8F6F2",
              borderColor:   active ? "#6B5D4F" : "#E2D9CC",
              color:         active ? "#3A2E22" : "#6B5D4F",
              fontWeight:    active ? 600 : 400,
              outline:       active ? "2px solid #6B5D4F" : "none",
              outlineOffset: "1px",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AISettingsContent({ profile, saveStatus, onField, onSave, onReset }: {
  profile: UserProfile;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onField: (field: keyof UserProfile, value: string) => void;
  onSave: () => void;
  onReset: (confirmed: boolean) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const currentStyle = ANALYSIS_STYLE_OPTIONS.find((o) => o.value === (profile.analysisStyle ?? "professional"));

  return (
    <div className="space-y-5">

      {/* Model */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: "#6B5D4F" }}>Модель для анализа</label>
        <div className="grid grid-cols-3 gap-2">
          {AI_MODELS.map((m) => {
            const active = (profile.aiModel ?? "gpt-4o") === m.value;
            return (
              <button
                key={m.value}
                onClick={() => onField("aiModel", m.value)}
                className="text-left rounded-xl border px-3 py-2.5 transition-all"
                style={{
                  background:    active ? "#EDE7DA" : "#F8F6F2",
                  borderColor:   active ? "#6B5D4F" : "#E2D9CC",
                  outline:       active ? "2px solid #6B5D4F" : "none",
                  outlineOffset: "1px",
                }}
              >
                <div className="text-sm font-semibold" style={{ color: active ? "#3A2E22" : "#6B5D4F" }}>{m.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>{m.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-1.5" style={{ color: "#A8997F" }}>
          Используется для анализа и чата. Транскрибация (Whisper) не зависит от этой настройки.
        </p>
      </div>

      {/* Analysis style */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: "#6B5D4F" }}>Стиль анализа</label>
        <SegButtons<AnalysisStyle>
          options={ANALYSIS_STYLE_OPTIONS}
          value={(profile.analysisStyle ?? "professional") as AnalysisStyle}
          onChange={(v) => onField("analysisStyle", v)}
        />
        {currentStyle?.hint && (
          <p className="text-xs mt-1.5" style={{ color: "#A8997F" }}>{currentStyle.hint}</p>
        )}
      </div>

      {/* Analysis length */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: "#6B5D4F" }}>Объём анализа</label>
        <SegButtons<AnalysisLength>
          options={ANALYSIS_LENGTH_OPTIONS}
          value={(profile.analysisLength ?? "standard") as AnalysisLength}
          onChange={(v) => onField("analysisLength", v)}
        />
      </div>

      {/* Chat style */}
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: "#6B5D4F" }}>Стиль ответов в чате</label>
        <SegButtons<ChatStyle>
          options={CHAT_STYLE_OPTIONS}
          value={(profile.chatStyle ?? "normal") as ChatStyle}
          onChange={(v) => onField("chatStyle", v)}
        />
        <p className="text-xs mt-1.5" style={{ color: "#A8997F" }}>
          Во всех вариантах ответы делятся на короткие абзацы.
        </p>
      </div>

      {/* Extra instructions */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B5D4F" }}>
          Что учитывать в ответах AI
          <span className="font-normal ml-1.5" style={{ color: "#A8997F" }}>(необязательно)</span>
        </label>
        <textarea
          value={profile.aiInstructions ?? ""}
          onChange={(e) => onField("aiInstructions", e.target.value)}
          placeholder="Обращай особое внимание на отношения клиента с родителями и избегание сложных тем"
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-brand-200 placeholder:text-stone-300"
          style={{ background: "#FFFFFF", borderColor: "#D4C9B5", color: "#3D3228" }}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#E5DDD2" }}>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#A8997F" }}>Вернуть стандартные настройки AI?</span>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "#D4C9B5", color: "#6B5D4F", background: "#F7F4EF" }}>
              Отмена
            </button>
            <button onClick={() => { onReset(true); setConfirmReset(false); }} className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: "#6B5D4F" }}>
              Вернуть
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "#D4C9B5", color: "#A8997F" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#EDE7DA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <RotateCcw size={12} /> Вернуть стандартные
          </button>
        )}
        <SaveRow status={saveStatus} onSave={onSave} label="Сохранить настройки" />
      </div>
    </div>
  );
}

// ── CityAnimContent ───────────────────────────────────────────────────────────

const INTENSITY_LABELS: Record<CityIntensity, string>    = { quiet: "Тихо", normal: "Обычно", lively: "Оживлённо" };
const FREQ_LABELS: Record<CharacterFrequency, string>    = { off: "Скрыть", rare: "Редко", normal: "Обычно", frequent: "Часто" };
const EGG_LABELS: Record<EasterEggFrequency, string>     = { very_rare: "Очень редко", rare: "Редко", sometimes: "Иногда" };

const CHARACTERS: { key: keyof CityAnimationSettings; label: string }[] = [
  { key: "catsFrequency",     label: "Кошки" },
  { key: "dogsFrequency",     label: "Собаки" },
  { key: "birdsFrequency",    label: "Птицы" },
  { key: "peopleFrequency",   label: "Люди" },
  { key: "carsFrequency",     label: "Машины" },
  { key: "cyclistsFrequency", label: "Велосипедисты" },
  { key: "busesFrequency",    label: "Автобусы" },
];

function AnimToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 40, height: 22, borderRadius: 11,
        border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? "#6B5D4F" : "#D4C9B5", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18,
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
      }} />
    </button>
  );
}

function SegControl<T extends string>({ options, value, onChange }: { options: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", border: "1px solid #D4C9B5", borderRadius: 8, overflow: "hidden" }}>
      {(Object.entries(options) as [T, string][]).map(([k, label]) => (
        <button
          key={k} onClick={() => onChange(k)}
          style={{
            padding: "4px 10px", fontSize: 12, border: "none", cursor: "pointer",
            background: value === k ? "#6B5D4F" : "#F7F4EF",
            color: value === k ? "#fff" : "#6B5D4F",
            borderRight: "1px solid #D4C9B5",
          }}
        >{label}</button>
      ))}
    </div>
  );
}

function AnimRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", gap: 16, borderBottom: "1px solid #EDE7DA" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#4A3C2E" }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "#A8997F", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function CityAnimContent({ settings, saveStatus, onChange, onReset, onSave }: {
  settings: CityAnimationSettings;
  saveStatus: "idle" | "saved";
  onChange: <K extends keyof CityAnimationSettings>(k: K, v: CityAnimationSettings[K]) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const [charOpen, setCharOpen]       = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-0">
      <AnimRow label="Анимация города" desc="Персонажи и события в иллюстрации на главной странице">
        <AnimToggle on={settings.animationEnabled} onChange={(v) => onChange("animationEnabled", v)} label="Включить анимацию" />
      </AnimRow>
      <AnimRow label="Интенсивность" desc="Как часто в городе происходят обычные события">
        <SegControl<CityIntensity> options={INTENSITY_LABELS} value={settings.intensity} onChange={(v) => onChange("intensity", v)} />
      </AnimRow>
      <AnimRow label="Интерактивные пасхалки" desc="Птицы, кошки и другие персонажи, на которых можно нажать">
        <AnimToggle on={settings.interactiveEasterEggsEnabled} onChange={(v) => onChange("interactiveEasterEggsEnabled", v)} label="Пасхалки" />
      </AnimRow>
      <AnimRow label="Редкие сюрпризы" desc="Самолётик из окна, ворона, машущий человек">
        <AnimToggle on={settings.rareSurprisesEnabled} onChange={(v) => onChange("rareSurprisesEnabled", v)} label="Сюрпризы" />
      </AnimRow>
      <AnimRow label="Звуки при взаимодействии" desc="Тихий звук после нажатия на персонажа">
        <AnimToggle on={settings.interactionSoundsEnabled} onChange={(v) => onChange("interactionSoundsEnabled", v)} label="Звуки" />
      </AnimRow>
      <AnimRow label="Тише во время консультации" desc="Город становится спокойнее при открытой консультации">
        <AnimToggle on={settings.reduceMotionDuringConsultation} onChange={(v) => onChange("reduceMotionDuringConsultation", v)} label="Тихий режим" />
      </AnimRow>

      {/* Sub-accordion: characters */}
      <div style={{ borderBottom: "1px solid #EDE7DA" }}>
        <button
          onClick={() => setCharOpen((o) => !o)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "#4A3C2E" }}>Тонкая настройка персонажей</span>
          <ChevronDown size={14} style={{ color: "#A8997F", transform: charOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {charOpen && (
          <div style={{ paddingBottom: 8 }}>
            {CHARACTERS.map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ fontSize: 12, color: "#4A3C2E", minWidth: 140 }}>{label}</span>
                <SegControl<CharacterFrequency> options={FREQ_LABELS} value={settings[key] as CharacterFrequency} onChange={(v) => onChange(key, v)} />
              </div>
            ))}
            <div style={{ height: 1, background: "#E5DDD2", margin: "6px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <div>
                <div style={{ fontSize: 12, color: "#4A3C2E", fontWeight: 500 }}>Частота пасхалок</div>
                <div style={{ fontSize: 11, color: "#A8997F" }}>Как часто появляются интерактивные события</div>
              </div>
              <SegControl<EasterEggFrequency> options={EGG_LABELS} value={settings.easterEggFrequency} onChange={(v) => onChange("easterEggFrequency", v)} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4">
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: "#A8997F" }}>Вернуть стандартные настройки?</span>
            <button onClick={() => setConfirmReset(false)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid #D4C9B5", background: "#F7F4EF", color: "#6B5D4F", cursor: "pointer" }}>Отмена</button>
            <button onClick={() => { onReset(); setConfirmReset(false); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "none", background: "#6B5D4F", color: "#fff", cursor: "pointer" }}>Вернуть</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid #D4C9B5", background: "#F7F4EF", color: "#6B5D4F", cursor: "pointer" }}>
            Вернуть стандартные
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveStatus === "saved" && (
            <span style={{ fontSize: 12, color: "#6B5D4F", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={13} /> Сохранено
            </span>
          )}
          <button
            onClick={onSave}
            style={{ fontSize: 12, padding: "5px 16px", borderRadius: 8, border: "none", background: "#6B5D4F", color: "#fff", cursor: "pointer", fontWeight: 500 }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, hint, type = "text" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B5D4F" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-200 placeholder:text-stone-300"
        style={{ background: "#FFFFFF", borderColor: "#D4C9B5", color: "#3D3228" }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: "#A8997F" }}>{hint}</p>}
    </div>
  );
}
