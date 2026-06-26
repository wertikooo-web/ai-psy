"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Save, Trash2, User, CheckCircle2, AlertCircle,
  Key, BrainCircuit, Database, Loader2, Camera, X, ArrowLeft, Sparkles,
  Building2, ChevronDown,
} from "lucide-react";
import type { UserProfile } from "@/lib/userProfile";
import { AI_MODELS } from "@/lib/userProfile";
import {
  type CityAnimationSettings,
  type CityIntensity,
  type CharacterFrequency,
  type EasterEggFrequency,
  DEFAULT_CITY_ANIMATION_SETTINGS,
  CITY_ANIM_STORAGE_KEY,
} from "@/lib/city-animation/types";

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
};

const APPROACHES = ["Гештальт", "КПТ", "ACT", "Схема-терапия", "Интегративный", "Другой"];

const ANALYSIS_MODES = [
  { value: "working",           label: "Рабочий анализ" },
  { value: "deep",              label: "Глубокий анализ" },
  { value: "therapist_process", label: "Анализ работы психолога (+A)" },
  { value: "gestalt",           label: "Гештальт-анализ (+G)" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<UserProfile>(EMPTY);
  const [status, setStatus]     = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);
  const [animEnabled, setAnimEnabled] = useState(true);
  const [cityAnim, setCityAnim] = useState<CityAnimationSettings>(DEFAULT_CITY_ANIMATION_SETTINGS);
  const [animSaveStatus, setAnimSaveStatus] = useState<"idle" | "saved">("idle");
  const saveAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI block
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [apiMasked, setApiMasked]         = useState<string | null>(null);
  const [checking, setChecking]           = useState(false);
  const [checkResult, setCheckResult]     = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CITY_ANIM_STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_CITY_ANIMATION_SETTINGS, ...JSON.parse(raw) };
        setCityAnim(parsed);
        setAnimEnabled(parsed.animationEnabled);
      } else {
        const legacy = localStorage.getItem("cityAnimation");
        if (legacy !== null) setAnimEnabled(legacy !== "false");
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
    if (key === "animationEnabled") setAnimEnabled(val as boolean);
    saveAnimSettings(next);
  }

  function resetAnimSettings() {
    setCityAnim(DEFAULT_CITY_ANIMATION_SETTINGS);
    setAnimEnabled(DEFAULT_CITY_ANIMATION_SETTINGS.animationEnabled);
    saveAnimSettings(DEFAULT_CITY_ANIMATION_SETTINGS);
  }

  function toggleAnim(val: boolean) { updateAnim("animationEnabled", val); }

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setProfile({ ...EMPTY, ...data }))
      .catch(() => {});

    fetch("/api/check-connection")
      .then((r) => r.json())
      .then((d) => { setApiConfigured(d.configured); setApiMasked(d.masked); })
      .catch(() => setApiConfigured(false));
  }, []);

  function set(field: keyof UserProfile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (status === "saved") setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify(profile),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      // Resize to max 200x200 via canvas before storing
      const img = new Image();
      img.onload = () => {
        const maxSize = 200;
        const scale   = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setProfile((p) => ({ ...p, photoUrl: dataUrl }));
        if (status === "saved") setStatus("idle");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleDelete() {
    if (!confirm("Очистить профиль? Имя и специализация вернутся к значениям по умолчанию.")) return;
    setDeleting(true);
    try {
      await fetch("/api/profile", { method: "DELETE" });
      setProfile(EMPTY);
      setStatus("idle");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCheckConnection() {
    setChecking(true);
    setCheckResult("");
    try {
      const res  = await fetch("/api/check-connection", { method: "POST" });
      const data = await res.json();
      setCheckResult(data.ok ? "✓ Подключение работает" : `✗ ${data.error}`);
    } catch {
      setCheckResult("✗ Ошибка проверки");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
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
          <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>Настройки</h1>
        </div>

        {/* ── Block 1: Profile ─────────────────────────────────────────────── */}
        <Block icon={<User size={15} className="text-brand-500" />} title="Профиль психолога" sub="Имя отображается в боковой панели и на главной">
          <div className="px-6 py-5 space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt="Фото" className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white text-lg font-bold border-2 border-slate-100">
                    {profile.firstName?.[0]?.toUpperCase() || "П"}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                    <Camera size={13} />
                    {profile.photoUrl ? "Сменить фото" : "Загрузить фото"}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {profile.photoUrl && (
                    <button
                      onClick={() => { setProfile((p) => ({ ...p, photoUrl: "" })); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-rose-400 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                    >
                      <X size={11} />
                      Удалить
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">JPG, PNG · отображается в боковой панели</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Имя" value={profile.firstName} onChange={(v) => set("firstName", v)} placeholder="Наталья" />
              <Field label="Фамилия" value={profile.lastName} onChange={(v) => set("lastName", v)} placeholder="Веселова" />
            </div>
            <Field
              label="Отображаемое имя"
              value={profile.displayName}
              onChange={(v) => set("displayName", v)}
              placeholder="Наталья В. — если пусто, используется Имя + Фамилия"
              hint="Показывается в боковой панели и приветствии"
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Подход</label>
              <select
                value={profile.approach ?? ""}
                onChange={(e) => set("approach", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 text-slate-700"
              >
                <option value="">— Выберите подход —</option>
                {APPROACHES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <Field
              label="Специализация (свободный текст)"
              value={profile.specialization}
              onChange={(v) => set("specialization", v)}
              placeholder="Гештальт-терапевт, работа с тревогой, травмой..."
            />
            <Field
              label="Email"
              value={profile.email ?? ""}
              onChange={(v) => set("email", v)}
              placeholder="you@example.com"
              type="email"
              hint="Опционально, не используется для авторизации"
            />
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} />
              Очистить профиль
            </button>
            <div className="flex items-center gap-3">
              {status === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Сохранено</span>}
              {status === "error" && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={13} />Ошибка</span>}
              <button
                onClick={handleSave}
                disabled={status === "saving"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60"
              >
                <Save size={13} />
                {status === "saving" ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </Block>

        {/* ── Block 2: AI ──────────────────────────────────────────────────── */}
        <Block icon={<Key size={15} className="text-amber-500" />} title="OpenAI подключение" sub="Статус API-ключа и модели">
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700 mb-0.5">API-ключ</div>
                {apiConfigured === null && <div className="text-xs text-slate-400">Проверка...</div>}
                {apiConfigured === true && (
                  <div className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Настроен · <span className="font-mono">{apiMasked}</span>
                  </div>
                )}
                {apiConfigured === false && (
                  <div className="text-xs text-rose-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Не настроен — установите OPENAI_API_KEY в Railway Variables
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckConnection}
                disabled={checking}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {checking ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Проверить
              </button>
            </div>
            {checkResult && (
              <div className={`text-sm px-3.5 py-2.5 rounded-xl ${checkResult.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                {checkResult}
              </div>
            )}
            <div className="text-sm text-slate-500 pt-1">
              Модель по умолчанию: <span className="font-mono text-slate-700">gpt-4o</span>
              <br />
              Транскрипция: <span className="font-mono text-slate-700">whisper-1</span>
            </div>
          </div>
        </Block>

        {/* ── Block 3: Analysis mode ───────────────────────────────────────── */}
        <Block icon={<BrainCircuit size={15} className="text-brand-500" />} title="Режим анализа по умолчанию" sub="Будет предвыбран при открытии консультации">
          <div className="px-6 py-5">
            <div className="space-y-2">
              {ANALYSIS_MODES.map((m) => (
                <label key={m.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="analysisMode"
                    value={m.value}
                    checked={profile.defaultAnalysisMode === m.value}
                    onChange={() => set("defaultAnalysisMode", m.value)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-800">{m.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              {status === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Настройки сохранены</span>}
              {status === "error"  && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={13} />Ошибка сохранения</span>}
              <button
                onClick={handleSave}
                disabled={status === "saving"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60"
              >
                <Save size={13} />
                {status === "saving" ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </Block>

        {/* ── Block 4: AI Model ────────────────────────────────────────────── */}
        <Block icon={<BrainCircuit size={15} className="text-purple-400" />} title="Модель AI" sub="Используется для анализа консультаций и чата">
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-2">
              {AI_MODELS.map((m) => {
                const active = (profile.aiModel ?? "gpt-4o") === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => set("aiModel", m.value)}
                    className="text-left rounded-xl border px-4 py-3 transition-all"
                    style={{
                      background:   active ? "#EDE7DA" : "#F8F6F2",
                      borderColor:  active ? "#6B5D4F" : "#E2D9CC",
                      outline:      active ? "2px solid #6B5D4F" : "none",
                      outlineOffset: "1px",
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: active ? "#3A2E22" : "#6B5D4F" }}>{m.label}</div>
                    <div className="text-xs mt-0.5 text-stone-400">{m.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              {status === "saved" && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Сохранено</span>}
              <button
                onClick={handleSave}
                disabled={status === "saving"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-60"
              >
                <Save size={13} />
                {status === "saving" ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </Block>

        {/* ── Block 5: City animation ──────────────────────────────────────── */}
        <CityAnimBlock
          settings={cityAnim}
          saveStatus={animSaveStatus}
          onChange={updateAnim}
          onReset={resetAnimSettings}
        />

        {/* ── Block 6: Data ────────────────────────────────────────────────── */}
        <Block icon={<Database size={15} className="text-slate-400" />} title="Данные" sub="Экспорт и резервное копирование — скоро">
          <div className="px-6 py-5 grid grid-cols-2 gap-3">
            {["Экспорт клиентов", "Экспорт консультаций", "История клиентов", "Резервная копия"].map((label) => (
              <button
                key={label}
                disabled
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400 cursor-not-allowed"
              >
                <span>{label}</span>
                <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">скоро</span>
              </button>
            ))}
          </div>
        </Block>

      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Block({ icon, title, sub, children }: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F7F4EF", borderColor: "#E5DDD2" }}>
      <div className="px-6 py-4 border-b flex items-center gap-3" style={{ background: "#F0EBE3", borderColor: "#E5DDD2" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E5DDD2" }}>{icon}</div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "#4A3C2E" }}>{title}</h2>
          <p className="text-xs" style={{ color: "#A8997F" }}>{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── City Animation Settings Block ─────────────────────────────────────────────

const INTENSITY_LABELS: Record<CityIntensity, string> = { quiet: "Тихо", normal: "Обычно", lively: "Оживлённо" };
const FREQ_LABELS: Record<CharacterFrequency, string> = { off: "Скрыть", rare: "Редко", normal: "Обычно", frequent: "Часто" };
const EGG_LABELS: Record<EasterEggFrequency, string> = { very_rare: "Очень редко", rare: "Редко", sometimes: "Иногда" };

const CHARACTERS: { key: keyof CityAnimationSettings; label: string }[] = [
  { key: "catsFrequency",      label: "Кошки" },
  { key: "dogsFrequency",      label: "Собаки" },
  { key: "birdsFrequency",     label: "Птицы" },
  { key: "peopleFrequency",    label: "Люди" },
  { key: "carsFrequency",      label: "Машины" },
  { key: "cyclistsFrequency",  label: "Велосипедисты" },
  { key: "busesFrequency",     label: "Автобусы" },
];

function AnimToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 44, height: 24, borderRadius: 12,
        border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? "#6B5D4F" : "#D4C9B5", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18,
        borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
      }} />
    </button>
  );
}

function SegControl<T extends string>({
  options, value, onChange,
}: { options: Record<T, string>; value: T; onChange: (v: T) => void }) {
  const entries = Object.entries(options) as [T, string][];
  return (
    <div style={{ display: "flex", border: "1px solid #D4C9B5", borderRadius: 8, overflow: "hidden" }}>
      {entries.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          style={{
            padding: "5px 10px", fontSize: 12, border: "none", cursor: "pointer",
            background: value === k ? "#6B5D4F" : "#F7F4EF",
            color: value === k ? "#fff" : "#6B5D4F",
            borderRight: "1px solid #D4C9B5",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AnimRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 24px", gap: 16, borderBottom: "1px solid #EDE7DA",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#4A3C2E" }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "#A8997F", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function CityAnimBlock({
  settings, saveStatus, onChange, onReset,
}: {
  settings: CityAnimationSettings;
  saveStatus: "idle" | "saved";
  onChange: <K extends keyof CityAnimationSettings>(k: K, v: CityAnimationSettings[K]) => void;
  onReset: () => void;
}) {
  const [charOpen, setCharOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F7F4EF", borderColor: "#E5DDD2" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ background: "#F0EBE3", borderColor: "#E5DDD2" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E5DDD2" }}>
            <Building2 size={15} style={{ color: "#6B5D4F" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "#4A3C2E" }}>Анимация города</h2>
            <p className="text-xs" style={{ color: "#A8997F" }}>Настройте, насколько оживлённым будет город на главной странице</p>
          </div>
        </div>
        {saveStatus === "saved" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B5D4F" }}>
            <CheckCircle2 size={13} />
            Сохранено
          </div>
        )}
      </div>

      {/* Section: основные */}
      <div style={{ borderBottom: "1px solid #EDE7DA" }}>
        <AnimRow label="Анимация города" desc="Персонажи и события в иллюстрации на главной странице">
          <AnimToggle on={settings.animationEnabled} onChange={v => onChange("animationEnabled", v)} label="Включить анимацию" />
        </AnimRow>
        <AnimRow label="Интенсивность жизни города" desc="Как часто в городе происходят обычные события">
          <SegControl<CityIntensity>
            options={INTENSITY_LABELS}
            value={settings.intensity}
            onChange={v => onChange("intensity", v)}
          />
        </AnimRow>
      </div>

      {/* Section: интерактивность */}
      <div style={{ borderBottom: "1px solid #EDE7DA" }}>
        <AnimRow label="Интерактивные пасхалки" desc="Птицы, кошки и другие персонажи, на которых можно нажать">
          <AnimToggle on={settings.interactiveEasterEggsEnabled} onChange={v => onChange("interactiveEasterEggsEnabled", v)} label="Интерактивные пасхалки" />
        </AnimRow>
        <AnimRow label="Редкие сюрпризы" desc="Самолётик из окна, человек машет, ворона и другие">
          <AnimToggle on={settings.rareSurprisesEnabled} onChange={v => onChange("rareSurprisesEnabled", v)} label="Редкие сюрпризы" />
        </AnimRow>
        <AnimRow label="Звуки при взаимодействии" desc="Тихий звук появляется только после нажатия на персонажа">
          <AnimToggle on={settings.interactionSoundsEnabled} onChange={v => onChange("interactionSoundsEnabled", v)} label="Звуки" />
        </AnimRow>
        <AnimRow label="Меньше движения во время консультации" desc="Во время работы с консультацией город становится спокойнее">
          <AnimToggle on={settings.reduceMotionDuringConsultation} onChange={v => onChange("reduceMotionDuringConsultation", v)} label="Тихий режим" />
        </AnimRow>
      </div>

      {/* Section: персонажи (коллапс) */}
      <div>
        <button
          onClick={() => setCharOpen(o => !o)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 24px", background: "transparent", border: "none", cursor: "pointer",
            borderBottom: charOpen ? "1px solid #EDE7DA" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#4A3C2E" }}>Тонкая настройка персонажей</span>
            {!charOpen && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#E5DDD2", color: "#6B5D4F" }}>свёрнуто</span>
            )}
          </div>
          <ChevronDown size={16} style={{ color: "#A8997F", transform: charOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>

        {charOpen && (
          <div style={{ background: "#F0EBE3" }}>
            <div style={{ padding: "4px 0 4px" }}>
              {CHARACTERS.map(({ key, label }) => (
                <div key={key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 24px", gap: 12,
                }}>
                  <span style={{ fontSize: 13, color: "#4A3C2E", minWidth: 140 }}>{label}</span>
                  <SegControl<CharacterFrequency>
                    options={FREQ_LABELS}
                    value={settings[key] as CharacterFrequency}
                    onChange={v => onChange(key, v)}
                  />
                </div>
              ))}
              <div style={{ height: 1, background: "#D8CFBE", margin: "8px 24px" }} />
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 24px", gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: "#4A3C2E", fontWeight: 500 }}>Частота пасхалок</div>
                  <div style={{ fontSize: 12, color: "#A8997F", marginTop: 2 }}>Как часто появляются интерактивные события</div>
                </div>
                <SegControl<EasterEggFrequency>
                  options={EGG_LABELS}
                  value={settings.easterEggFrequency}
                  onChange={v => onChange("easterEggFrequency", v)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset */}
      <div style={{ borderTop: "1px solid #EDE7DA", padding: "12px 24px", display: "flex", justifyContent: "flex-end" }}>
        {confirmReset ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#A8997F" }}>Вернуть стандартные настройки?</span>
            <button onClick={() => setConfirmReset(false)} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 8, border: "1px solid #D4C9B5", background: "#F7F4EF", color: "#6B5D4F", cursor: "pointer" }}>
              Отмена
            </button>
            <button onClick={() => { onReset(); setConfirmReset(false); }} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 8, border: "none", background: "#6B5D4F", color: "#fff", cursor: "pointer" }}>
              Вернуть
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid #D4C9B5", background: "#F7F4EF", color: "#6B5D4F", cursor: "pointer" }}>
            Вернуть стандартные настройки
          </button>
        )}
      </div>
    </div>
  );
}

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
        className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-stone-300"
        style={{ background: "#FFFFFF", borderColor: "#D4C9B5", color: "#3D3228" }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: "#A8997F" }}>{hint}</p>}
    </div>
  );
}
