"use client";

import { useEffect, useRef } from "react";

export function FluidGame({ onEsc }: { onEsc: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "RELAX_ESC") onEsc();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEsc]);

  return (
    <iframe
      ref={iframeRef}
      src="/relax/fluid/index.html"
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      allow="fullscreen"
      title="Потоки"
    />
  );
}
