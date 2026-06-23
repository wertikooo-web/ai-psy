"use client";

import { useState, useCallback } from "react";
import { Consultation } from "@/lib/mockData";
import { TranscriptPanel } from "./TranscriptPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { ChatPanel } from "./ChatPanel";
import { CompareModal } from "./CompareModal";

interface Props {
  consultation: Consultation;
}

export function ConsultationClient({ consultation }: Props) {
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleSendToChat = useCallback((text: string) => {
    setPendingMessage(text);
  }, []);

  const handleMessageConsumed = useCallback(() => {
    setPendingMessage(null);
  }, []);

  return (
    <>
      <div className="flex-1 overflow-hidden grid grid-cols-3">
        <TranscriptPanel segments={consultation.transcript} />

        <AnalysisPanel
          sections={consultation.analysis}
          modeAnalysis={consultation.modeAnalysis}
          digDeeper={consultation.digDeeper}
          voiceAnalysis={consultation.voiceAnalysis}
          clientName={consultation.clientName}
          date={consultation.date}
          onSendToChat={handleSendToChat}
          onCompare={() => setCompareOpen(true)}
        />

        <ChatPanel
          messages={consultation.chat}
          pendingMessage={pendingMessage}
          onMessageConsumed={handleMessageConsumed}
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
