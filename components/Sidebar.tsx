"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, FileText, BookOpen, Bot,
  Settings, HelpCircle, BrainCircuit, Mic,
} from "lucide-react";
import { UploadModal } from "@/components/upload/UploadModal";
import { UserChip } from "@/components/UserChip";

// ── Craft palette ─────────────────────────────────────────────────────────────
const C = {
  bg:          "#F7F7F8",   // sidebar background
  border:      "#E5E7EB",   // dividers / borders
  active:      "#E7DDCC",   // active nav item bg
  hover:       "#E2D8C7",   // hover nav item bg
  activeTxt:   "#4A3C2E",   // active item text
  idleTxt:     "#7A6E60",   // idle item text
  groupLabel:  "#A8997F",   // section label ("Основное" etc.)
  logoBg:      "#E2D9CC",   // logo area bg
  uploadBdr:   "#D4C9B5",   // dashed upload button border
};

const mainNav = [
  { href: "/",              label: "Главная",      icon: Home     },
  { href: "/clients",       label: "Клиенты",      icon: Users    },
  { href: "/consultations", label: "Консультации", icon: FileText },
];

const toolsNav = [
  { href: "/knowledge-base", label: "База знаний", icon: BookOpen },
  { href: "/psy-gpts",       label: "PSY-GPTs",    icon: Bot      },
];

const systemNav = [
  { href: "/settings", label: "Настройки", icon: Settings   },
  { href: "/help",     label: "Помощь",    icon: HelpCircle },
];


// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, exact = false,
}: { href: string; label: string; icon: React.ElementType; exact?: boolean }) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        background: active ? C.active  : "transparent",
        color:      active ? C.activeTxt : C.idleTxt,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.hover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <aside
        className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0"
        style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="px-5 py-5 flex items-center gap-2.5 transition-opacity hover:opacity-80"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: C.active, border: `1px solid ${C.uploadBdr}` }}
          >
            <BrainCircuit size={18} style={{ color: C.activeTxt }} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight" style={{ color: C.activeTxt }}>
              TRANSCRIPT AI
            </div>
            <div className="text-xs font-semibold tracking-wider" style={{ color: C.groupLabel }}>
              PSY
            </div>
          </div>
        </Link>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-8">

          {/* Группа 1: Основное + Загрузить запись */}
          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Основное
            </div>
            {mainNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} exact={href === "/"} />
            ))}
            <button
              onClick={() => setUploadOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ color: C.idleTxt, background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.activeTxt; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.idleTxt; }}
            >
              <Mic size={16} strokeWidth={1.8} />
              Загрузить запись
            </button>
          </div>

          {/* Группа 2: Инструменты */}
          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Инструменты
            </div>
            {toolsNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} />
            ))}
          </div>

          {/* Группа 3: Система */}
          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Система
            </div>
            {systemNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} />
            ))}
          </div>

        </nav>

        {/* UserChip — отдельно в самом низу */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <UserChip />
        </div>
      </aside>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
