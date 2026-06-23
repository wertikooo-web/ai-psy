"use client";

import { useState, useEffect } from "react";
import { Save, Trash2, User, CheckCircle2, AlertCircle } from "lucide-react";
import type { UserProfile } from "@/lib/userProfile";

const EMPTY: UserProfile = {
  firstName:      "",
  lastName:       "",
  displayName:    "",
  specialization: "",
  email:          "",
};

export default function SettingsPage() {
  const [profile, setProfile]   = useState<UserProfile>(EMPTY);
  const [status, setStatus]     = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setProfile({ ...EMPTY, ...data }))
      .catch(() => {});
  }, []);

  function set(field: keyof UserProfile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (status === "saved") setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(profile),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-xl font-bold text-slate-800 mb-1">Настройки</h1>
      <p className="text-sm text-slate-400 mb-8">Управление профилем и параметрами</p>

      {/* Profile block */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <User size={15} className="text-brand-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Профиль психолога</h2>
            <p className="text-xs text-slate-400">Имя отображается в боковой панели и на главной</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Имя"
              value={profile.firstName}
              onChange={(v) => set("firstName", v)}
              placeholder="Наталья"
            />
            <Field
              label="Фамилия"
              value={profile.lastName}
              onChange={(v) => set("lastName", v)}
              placeholder="Веселова"
            />
          </div>

          <Field
            label="Отображаемое имя"
            value={profile.displayName}
            onChange={(v) => set("displayName", v)}
            placeholder="Наталья В. — если оставить пустым, используется Имя + Фамилия"
            hint="Показывается в боковой панели и приветствии"
          />

          <Field
            label="Специализация / подход"
            value={profile.specialization}
            onChange={(v) => set("specialization", v)}
            placeholder="Гештальт-терапевт, CBT, EMDR..."
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
            {status === "saved" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 size={13} />
                Сохранено
              </span>
            )}
            {status === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle size={13} />
                Ошибка сохранения
              </span>
            )}
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
      </div>

      {/* Future sections placeholder */}
      <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 opacity-50">
        <h2 className="text-sm font-semibold text-slate-400">Уведомления</h2>
        <p className="text-xs text-slate-300 mt-0.5">Скоро</p>
      </div>
    </div>
    </div>
  );
}

// ── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-slate-300"
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
