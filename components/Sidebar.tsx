"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, FileText, BookOpen, Bot,
  Settings, HelpCircle, BrainCircuit, Mic, X, MessageSquare, Info,
} from "lucide-react";
import { UploadModal } from "@/components/upload/UploadModal";
import { UserChip } from "@/components/UserChip";

// ── Craft palette ─────────────────────────────────────────────────────────────
const C = {
  bg:         "#F7F7F8",
  border:     "#E5E7EB",
  active:     "#E7DDCC",
  hover:      "#E2D8C7",
  activeTxt:  "#4A3C2E",
  idleTxt:    "#7A6E60",
  groupLabel: "#A8997F",
  uploadBdr:  "#D4C9B5",
};

const mainNav = [
  { href: "/",              label: "Главная",      icon: Home     },
  { href: "/clients",       label: "Клиенты",      icon: Users    },
  { href: "/consultations", label: "Консультации", icon: FileText },
];
const toolsNav = [
  { href: "/ai-chat",        label: "AI Чат",      icon: MessageSquare },
  { href: "/psy-gpts",       label: "PSY-GPTs",    icon: Bot           },
  { href: "/knowledge-base", label: "База знаний", icon: BookOpen      },
];
const systemNav = [
  { href: "/settings", label: "Настройки", icon: Settings   },
  { href: "/help",     label: "Помощь",    icon: HelpCircle },
  { href: "/about",    label: "About",     icon: Info       },
];

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, exact = false, onNavigate,
}: {
  href: string; label: string; icon: React.ElementType; exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        background: active ? C.active : "transparent",
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
interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll when mobile overlay is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else       document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const nav = (
    <>
      <aside
        className="w-60 flex-shrink-0 flex flex-col h-full"
        style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={onClose}
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
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={(e) => { e.preventDefault(); onClose(); }}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center lg:hidden"
              style={{ color: C.idleTxt }}
            >
              <X size={16} />
            </button>
          )}
        </Link>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-8">

          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Основное
            </div>
            {mainNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} exact={href === "/"} onNavigate={onClose} />
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

          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Инструменты
            </div>
            {toolsNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} onNavigate={onClose} />
            ))}
          </div>

          <div className="space-y-0.5">
            <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
              Система
            </div>
            {systemNav.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} onNavigate={onClose} />
            ))}
          </div>

        </nav>

        {/* UserChip */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <UserChip />
        </div>
      </aside>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );

  // Desktop: always visible inline
  // Mobile: controlled overlay via props
  return (
    <>
      {/* Desktop sidebar — always in flow */}
      <div className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">
        {nav}
      </div>

      {/* Mobile sidebar — overlay */}
      <div className="lg:hidden">
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
        )}
        {/* Slide-in panel */}
        <div
          className="fixed top-0 left-0 h-full z-50 flex flex-col"
          style={{
            transform: open ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            willChange: "transform",
          }}
        >
          {nav}
        </div>
      </div>
    </>
  );
}
