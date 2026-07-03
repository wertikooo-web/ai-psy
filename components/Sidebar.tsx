"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users, FileText, Bot,
  Settings, HelpCircle, BrainCircuit, Mic, X, MessageSquare, Info, BookOpenText,
  PanelLeftClose, PanelLeft, ChevronsLeft, CalendarDays, BarChart3, WalletCards, Search,
  GraduationCap,
} from "lucide-react";
import { UploadModal } from "@/components/upload/UploadModal";
import { UserChip } from "@/components/UserChip";

export type SidebarMode = "full" | "decorative" | "hidden";

// ── Palette: full sidebar ─────────────────────────────────────────────────────
const C = {
  bg:         "#F7F7F8",
  border:     "#E5E5E5",
  active:     "#ECECED",
  hover:      "#EFEFEF",
  activeTxt:  "#111827",
  idleTxt:    "#6B7280",
  groupLabel: "#9CA3AF",
};

// ── Palette: decorative panel ─────────────────────────────────────────────────
// D.bg sampled from the actual illustration background (light warm cream)
const D = {
  bg:     "#FAF5EF",
  border: "rgba(130, 100, 70, 0.14)",
  btnHov: "#EFE9E0",
  btnTxt: "#9C8E80",
};

// ── Widths ────────────────────────────────────────────────────────────────────
export const FULL_W  = 240;
// Decorative mode keeps the same width as full — only hidden collapses to 0
const LOGO_H = 64; // logo area height, matches full sidebar header

// ── Nav data ──────────────────────────────────────────────────────────────────
const mainNav = [
  { href: "/",              label: "Главная",      icon: Home        },
  { href: "/clients",       label: "Клиенты",      icon: Users       },
  { href: "/consultations", label: "Консультации", icon: FileText    },
];
const toolsNav = [
  { href: "/payments", label: "Оплаты",            icon: WalletCards  },
  { href: "/calendar", label: "Календарь",         icon: CalendarDays },
  { href: "/ai-chat",  label: "AI сервисы",       icon: MessageSquare },
  { href: "/psy-gpts", label: "PSY-GPTs",          icon: Bot           },
  { href: "/notebook", label: "Блокнот психолога", icon: BookOpenText  },
];
const profDevNav = [
  { href: "/professional-development", label: "Проф. развитие", icon: GraduationCap },
];

const systemNav = [
  { href: "/analytics",      label: "Аналитика",   icon: BarChart3  },
  { href: "/settings",       label: "Настройки",   icon: Settings   },
  { href: "/help",     label: "Помощь",             icon: HelpCircle  },
  { href: "/about",    label: "About",              icon: Info        },
];

// ── NavItem ───────────────────────────────────────────────────────────────────
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
      className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
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

// ── Decorative icon button ────────────────────────────────────────────────────
function DecoBtn({
  icon: Icon, onClick, label, title: t,
}: { icon: React.ElementType; onClick: () => void; label: string; title: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none",
        color: D.btnTxt, cursor: "pointer",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = D.btnHov; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      aria-label={label}
      title={t}
    >
      <Icon size={15} />
    </button>
  );
}

// ── Nav groups ────────────────────────────────────────────────────────────────
function NavGroups({ onNavigate, onUpload, onSearch }: { onNavigate?: () => void; onUpload: () => void; onSearch?: () => void }) {
  return (
    <nav className="flex-1 min-h-0 px-3 py-2 overflow-y-hidden flex flex-col gap-3">

      {/* ── Global search button ── */}
      {onSearch && (
        <button
          onClick={() => { onSearch(); onNavigate?.(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
          style={{ background: "#EEEBE5", border: "1px solid #E0D9CE", color: "#8A7A6A" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E2D8"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#EEEBE5"; }}
        >
          <Search size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span className="flex-1 text-left" style={{ color: "#9C8E80" }}>Поиск...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono" style={{ color: "#B8AA99" }}>Ctrl+K</kbd>
        </button>
      )}

      <div className="space-y-0.5 mt-[15px]">
        <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
          Основное
        </div>
        {mainNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} exact={href === "/"} onNavigate={onNavigate} />
        ))}
        <button
          onClick={onUpload}
          className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: C.idleTxt, background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.activeTxt; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.idleTxt; }}
        >
          <Mic size={16} strokeWidth={1.8} />
          Загрузить запись
        </button>
      </div>

      <div className="space-y-0.5 pt-[35px] mt-[27px]" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
          Инструменты
        </div>
        {toolsNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="space-y-0.5 pt-[35px] mt-[27px]" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
          Развитие
        </div>
        {profDevNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="space-y-0.5 pt-[35px] mt-[27px]" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: C.groupLabel }}>
          Система
        </div>
        {systemNav.map(({ href, label, icon }) => (
          <NavItem key={href} href={href} label={label} icon={icon} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  mode: SidebarMode;
  onModeChange: (m: SidebarMode) => void;
  onSearch?: () => void;
}

export function Sidebar({ open, onClose, mode, onModeChange, onSearch }: SidebarProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  // Delay enabling transitions until after first paint — prevents layout flash
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTransitionEnabled(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // ESC closes mobile overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock scroll on mobile overlay
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const easing     = "cubic-bezier(0.4,0,0.2,1)";
  const wTrans     = transitionEnabled ? `width 280ms ${easing}` : "none";
  const opTrans    = transitionEnabled ? `opacity 200ms ${easing}` : "none";
  // full and decorative share the same width — only hidden collapses
  const deskWidth  = mode === "hidden" ? 0 : FULL_W;

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────── */}
      <div
        className="hidden lg:block h-screen sticky top-0 overflow-hidden flex-shrink-0"
        style={{ width: deskWidth, transition: wTrans, position: "relative" }}
        role="navigation"
        aria-label="Боковая навигация"
        aria-expanded={mode === "full"}
      >

        {/* ── FULL panel ──────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, bottom: 0,
            width: FULL_W,
            opacity: mode === "full" ? 1 : 0,
            pointerEvents: mode === "full" ? "auto" : "none",
            transition: opTrans,
            display: "flex", flexDirection: "column",
            background: C.bg,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          {/* Logo row + collapse button */}
          <div
            className="px-4 py-4 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${C.border}`, minHeight: 64 }}
          >
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#E9E9EA", border: `1px solid ${C.border}` }}
              >
                <BrainCircuit size={18} style={{ color: C.activeTxt }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight" style={{ color: "#111827" }}>TRANSCRIPT AI</div>
                <div className="text-xs font-semibold tracking-wider" style={{ color: "#9CA3AF" }}>PSY</div>
              </div>
            </Link>

            <button
              onClick={() => onModeChange("decorative")}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ color: C.idleTxt }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Свернуть боковое меню"
              title="Свернуть"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <NavGroups onUpload={() => setUploadOpen(true)} onSearch={onSearch} />

          <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
            <UserChip />
          </div>
        </div>

        {/* ── DECORATIVE panel ────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, bottom: 0,
            width: FULL_W,
            opacity: mode === "decorative" ? 1 : 0,
            pointerEvents: mode === "decorative" ? "auto" : "none",
            transition: opTrans,
            background: D.bg,
            borderRight: `1px solid ${D.border}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Zone 1: Logo header — fixed height, matches full panel */}
          <div
            style={{
              height: LOGO_H,
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 16px",
              borderBottom: `1px solid ${D.border}`,
            }}
          >
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#EDE8DE", border: `1px solid ${D.border}` }}
              >
                <BrainCircuit size={18} style={{ color: "#6B5D4F" }} />
              </div>
            </Link>
            <div style={{ display: "flex", gap: 2 }}>
              <DecoBtn
                icon={PanelLeft}
                onClick={() => onModeChange("full")}
                label="Открыть боковое меню"
                title="Открыть меню"
              />
              <DecoBtn
                icon={ChevronsLeft}
                onClick={() => onModeChange("hidden")}
                label="Скрыть боковую панель полностью"
                title="Скрыть панель"
              />
            </div>
          </div>

          {/* Zone 2: Illustration — centred, natural proportions, never stretched */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sidebar-psychologist.png"
              alt="Иллюстрация психолога"
              draggable={false}
              style={{
                width: "auto",
                height: "auto",
                maxWidth: "82%",
                maxHeight: "clamp(360px, 58dvh, 680px)",
                objectFit: "contain",
                transform: "translateY(calc(-2% + 94px))",
                userSelect: "none",
                pointerEvents: "none",
                display: "block",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 86%, transparent 100%)",
                maskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 86%, transparent 100%)",
              }}
            />
          </div>

          {/* Zone 3: User profile — same as full panel footer */}
          <div
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${D.border}`,
              padding: "0 8px 8px",
            }}
          >
            <UserChip />
          </div>
        </div>
      </div>

      {/* ── MOBILE OVERLAY ──────────────────────────────────────────────── */}
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
          className="fixed top-0 left-0 h-full z-50"
          style={{
            transform:  open ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            willChange: "transform",
          }}
        >
          <aside
            className="w-60 h-full flex flex-col"
            style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
          >
            <Link
              href="/"
              onClick={onClose}
              className="px-5 py-5 flex items-center gap-2.5 transition-opacity hover:opacity-80"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#E9E9EA", border: `1px solid ${C.border}` }}
              >
                <BrainCircuit size={18} style={{ color: C.activeTxt }} />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight" style={{ color: "#111827" }}>TRANSCRIPT AI</div>
                <div className="text-xs font-semibold tracking-wider" style={{ color: "#9CA3AF" }}>PSY</div>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); onClose?.(); }}
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center lg:hidden"
                style={{ color: C.idleTxt }}
                aria-label="Закрыть меню"
              >
                <X size={16} />
              </button>
            </Link>

            <NavGroups onNavigate={onClose} onUpload={() => setUploadOpen(true)} onSearch={onSearch} />

            <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <UserChip />
            </div>
          </aside>
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
