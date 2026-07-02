"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Eye, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import type { SidebarMode } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { ObservationModal } from "@/components/observation/ObservationModal";
import { GlobalSearch } from "@/components/GlobalSearch";

interface AppShellProps {
  children: React.ReactNode;
  initialSidebarMode?: SidebarMode;
}

export function AppShell({ children, initialSidebarMode = "full" }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [observationOpen, setObservationOpen] = useState(false);
  const [tooltip,         setTooltip]         = useState(false);
  const [sidebarMode,     setSidebarMode]     = useState<SidebarMode>(initialSidebarMode);

  const onConsultation = pathname.startsWith("/consultation/");

  function handleModeChange(mode: SidebarMode) {
    setSidebarMode(mode);
    localStorage.setItem("app_sidebar_mode", mode);
    // Cookie lets the server render the correct mode on next page load (no flash)
    document.cookie = `app_sidebar_mode=${mode};path=/;max-age=31536000`;
  }

  useEffect(() => {
    const handler = () => setObservationOpen(true);
    window.addEventListener("open-observation-modal", handler);
    return () => window.removeEventListener("open-observation-modal", handler);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-detect current client from URL: /client/[id]
  const clientMatch        = pathname.match(/^\/client\/([^/]+)/);
  const currentClientId    = clientMatch?.[1] ?? undefined;

  // Auto-detect consultation ID from URL: /consultation/[id]
  const consultMatch           = pathname.match(/^\/consultation\/([^/]+)/);
  const currentConsultationId  = consultMatch?.[1] ?? undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar wrapper — zIndex above city canvas overlay */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0 }}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          mode={sidebarMode}
          onModeChange={handleModeChange}
          onSearch={() => setSearchOpen(true)}
        />
      </div>

      {/* Hidden-mode pull handle — desktop only, fixed to left edge */}
      {sidebarMode === "hidden" && (
        <button
          className="hidden lg:flex items-center justify-center"
          onClick={() => handleModeChange("decorative")}
          style={{
            position:            "fixed",
            left:                0,
            top:                 "50%",
            transform:           "translateY(-50%)",
            zIndex:              25,
            width:               16,
            height:              52,
            borderTopRightRadius:    8,
            borderBottomRightRadius: 8,
            background:          "#E9DCC7",
            border:              "1px solid #D8CFBE",
            borderLeft:          "none",
            color:               "#9C8E80",
            cursor:              "pointer",
            boxShadow:           "2px 0 8px rgba(0,0,0,0.10)",
            transition:          "width 150ms ease, background 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.width      = "22px";
            e.currentTarget.style.background = "#D8CFBE";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.width      = "16px";
            e.currentTarget.style.background = "#E9DCC7";
          }}
          aria-label="Показать мини-панель"
          title="Показать панель"
        >
          <ChevronRight size={10} />
        </button>
      )}

      <main
        className="flex-1 overflow-hidden flex flex-col min-h-0 relative"
        style={{ zIndex: 10 }}
      >
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col pb-16 lg:pb-0">
          {children}
        </div>

        {/* Bottom nav — mobile only */}
        <BottomNav onMoreClick={() => setSidebarOpen(true)} />

        {/* Observation FAB */}
        <div
          className={`fixed right-4 lg:right-6 z-40 ${onConsultation ? "bottom-[76px] lg:bottom-[109px]" : "bottom-[76px] lg:bottom-[43px]"}`}
        >
          {tooltip && (
            <div
              className="absolute right-0 bottom-[calc(100%+10px)] rounded-xl px-3 py-2 text-xs shadow-lg pointer-events-none"
              style={{
                background: "#3D3228",
                color:      "#FDFAF5",
                border:     "1px solid #2A221A",
                maxWidth:   260,
                whiteSpace: "normal",
                textAlign:  "right",
                lineHeight: "1.4",
              }}
            >
              <p className="font-medium">Добавить наблюдение</p>
              <p className="opacity-75 mt-0.5">Для голосовой диктовки используйте Win + H</p>
            </div>
          )}

          <button
            onClick={() => setObservationOpen(true)}
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
            className="flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{
              width:        56,
              height:       56,
              borderRadius: "50%",
              background:   "white",
              border:       "2.5px solid #D8CFBE",
              boxShadow:    "0 4px 16px rgba(0,0,0,0.15)",
            }}
            aria-label="Добавить наблюдение"
            onMouseDown={(e) => { e.currentTarget.style.background = "#EDE7DA"; e.currentTarget.style.borderColor = "#A8997F"; }}
            onMouseUp={(e)   => { e.currentTarget.style.background = "white";   e.currentTarget.style.borderColor = "#D8CFBE"; }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: "#4A3C2E" }}
            >
              <Eye size={18} color="white" />
            </div>
          </button>
        </div>
      </main>

      {observationOpen && (
        <ObservationModal
          onClose={() => setObservationOpen(false)}
          defaultClientId={currentClientId}
          consultationId={currentConsultationId}
        />
      )}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
