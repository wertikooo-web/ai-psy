"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { UserProfile } from "@/lib/userProfile";
import { resolveDisplayName, resolveInitials } from "@/lib/userProfile";

export function UserChip() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {});
  }, []);

  const name = profile ? resolveDisplayName(profile) : "Психолог";
  const spec = profile?.specialization?.trim() || "Психолог";
  const abbr = profile ? resolveInitials(profile) : "П";

  return (
    <Link
      href="/settings"
      className="mt-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-2.5 transition-colors group"
      title="Настройки профиля"
    >
      <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {abbr}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-800">{name}</div>
        <div className="text-xs text-slate-400 truncate">{spec}</div>
      </div>
    </Link>
  );
}
