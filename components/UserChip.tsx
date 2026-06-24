"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { UserProfile } from "@/lib/userProfile";
import { resolveDisplayName, resolveInitials } from "@/lib/userProfile";
import { Settings, X, Mail, Brain, Layers } from "lucide-react";

export function UserChip() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {});
  }, []);

  const name     = profile ? resolveDisplayName(profile) : "Психолог";
  const abbr     = profile ? resolveInitials(profile) : "П";
  const subtitle = profile?.approach?.trim() || profile?.specialization?.trim() || "Психолог";
  const photo    = profile?.photoUrl;

  return (
    <>
      {/* ── Chip в сайдбаре ── */}
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-2.5 transition-colors group text-left"
        title="Профиль"
      >
        {photo ? (
          <img src={photo} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {abbr}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-800">{name}</div>
          <div className="text-xs text-slate-400 truncate">{subtitle}</div>
        </div>
      </button>

      {/* ── Модальное окно профиля ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Шапка с аватаром */}
            <div className="relative px-6 pt-8 pb-5 bg-gradient-to-br from-slate-50 to-stone-100 text-center border-b border-slate-100">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors"
              >
                <X size={15} />
              </button>

              {photo ? (
                <img src={photo} alt={name} className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-white shadow-sm" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl font-bold mx-auto border-2 border-white shadow-sm">
                  {abbr}
                </div>
              )}

              <h2 className="mt-3 text-base font-semibold text-slate-800">{name}</h2>
              {subtitle !== "Психолог" && (
                <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>

            {/* Детали */}
            <div className="px-6 py-4 space-y-3">
              {profile?.email && (
                <Row icon={<Mail size={14} />} label="Email" value={profile.email} />
              )}
              {profile?.approach && (
                <Row icon={<Brain size={14} />} label="Подход" value={profile.approach} />
              )}
              {profile?.specialization && profile.specialization !== profile.approach && (
                <Row icon={<Layers size={14} />} label="Специализация" value={profile.specialization} />
              )}
              {profile?.defaultAnalysisMode && (
                <Row
                  icon={<Brain size={14} />}
                  label="Режим анализа"
                  value={{
                    working:           "Рабочий",
                    deep:              "Глубокий",
                    therapist_process: "Анализ работы психолога",
                    gestalt:           "Гештальт-анализ",
                  }[profile.defaultAnalysisMode] ?? profile.defaultAnalysisMode}
                />
              )}
            </div>

            {/* Переход к настройкам */}
            <div className="px-6 pb-5">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <Settings size={14} />
                Редактировать в настройках
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-sm text-slate-700 font-medium break-words">{value}</div>
      </div>
    </div>
  );
}
