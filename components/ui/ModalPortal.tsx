"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body via createPortal.
 * Prevents stacking-context issues when modals are inside Sidebar or other
 * flex containers that paint before <main> in the DOM order.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current = document.createElement("div");
    ref.current.setAttribute("data-modal-portal", "true");
    document.body.appendChild(ref.current);
    setMounted(true);
    return () => {
      if (ref.current) document.body.removeChild(ref.current);
    };
  }, []);

  if (!mounted || !ref.current) return null;
  return createPortal(children, ref.current);
}
