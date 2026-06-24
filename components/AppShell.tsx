"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Mic } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { VoiceNoteModal } from "@/components/voice/VoiceNoteModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [voiceNoteOpen, setVoiceNoteOpen] = useState(false);
  const onConsultation = pathname.startsWith("/consultation/");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden absolute top-4 left-4 z-30 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border transition-colors"
          style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
          aria-label="Открыть меню"
        >
          <Menu size={18} />
        </button>

        {/* Offset for mobile hamburger button */}
        <div className="lg:hidden h-14 flex-shrink-0" />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Voice note FAB — raised above chat input on consultation pages */}
        <button
          onClick={() => setVoiceNoteOpen(true)}
          title="Голосовая заметка"
          className="fixed right-6 z-40 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            background: "#6B5D4F",
            width: 52, height: 52,
            bottom: onConsultation ? "90px" : "24px",
          }}
          aria-label="Записать голосовую заметку"
        >
          <Mic size={20} color="white" />
        </button>
      </main>

      {voiceNoteOpen && (
        <VoiceNoteModal onClose={() => setVoiceNoteOpen(false)} />
      )}
    </div>
  );
}
