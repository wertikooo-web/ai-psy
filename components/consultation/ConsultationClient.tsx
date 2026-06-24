"use client";

import { useState, useCallback, useMemo } from "react";
import { Consultation } from "@/lib/mockData";
import { TranscriptPanel } from "./TranscriptPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { ChatPanel } from "./ChatPanel";
import { CompareModal } from "./CompareModal";

type PanelKey = "transcript" | "analysis" | "chat";

interface Props {
  consultation: Consultation;
}

export function ConsultationClient({ consultation }: Props) {
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [compareOpen, setCompareOpen]       = useState(false);
  const [collapsed, setCollapsed]           = useState<Record<PanelKey, boolean>>({
    transcript: false,
    analysis:   false,
    chat:       false,
  });

  const toggle = useCallback((key: PanelKey) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSendToChat = useCallback((text: string) => {
    setPendingMessage(text);
    setCollapsed(prev => ({ ...prev, chat: false }));
  }, []);

  const handleMessageConsumed = useCallback(() => {
    setPendingMessage(null);
  }, []);

  // Build plain-text transcript from segments for the AI
  const transcriptText = useMemo(() => {
    if (!consultation.transcript?.length) return undefined;
    return consultation.transcript
      .map(s => `${s.speakerName} [${s.timestamp}]: ${s.text}`)
      .join("\n");
  }, [consultation.transcript]);

  return (
    <>
      <div className="flex-1 min-h-0 flex overflow-hidden divide-x divide-slate-100">
        <TranscriptPanel
          segments={consultation.transcript}
          collapsed={collapsed.transcript}
          onToggle={() => toggle("transcript")}
        />

        <AnalysisPanel
          sections={consultation.analysis}
          modeAnalysis={consultation.modeAnalysis}
          digDeeper={consultation.digDeeper}
          voiceAnalysis={consultation.voiceAnalysis}
          clientName={consultation.clientName}
          date={consultation.date}
          onSendToChat={handleSendToChat}
          onCompare={() => setCompareOpen(true)}
          collapsed={collapsed.analysis}
          onToggle={() => toggle("analysis")}
        />

        <ChatPanel
          messages={consultation.chat}
          pendingMessage={pendingMessage}
          onMessageConsumed={handleMessageConsumed}
          collapsed={collapsed.chat}
          onToggle={() => toggle("chat")}
          transcriptText={transcriptText}
        />
      </div>

      {consultation.compareData && (
        <CompareModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          data={consultation.compareData}
          clientName={consultation.clientName}
        />
      )}
    </>
  );
}
