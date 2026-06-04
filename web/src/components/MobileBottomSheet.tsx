import { useEffect } from "react";
import { BORDER, PANEL_BG } from "../theme";

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 0–1 of viewport height that the sheet should take when fully open. */
  heightVh?: number;
  children: React.ReactNode;
}

/**
 * Bottom-up modal sheet for mobile content (e.g. the gallery panel). Tap
 * backdrop or press Escape to close. Background scroll is locked while open.
 */
export default function MobileBottomSheet({
  open,
  onClose,
  heightVh = 0.92,
  children,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.18s ease",
          zIndex: 50,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          // dvh (dynamic viewport height) handles iOS Safari's collapsing
          // URL bar — `vh` is fixed to the *expanded* viewport, so a 92vh
          // sheet would overflow when the bar collapses. dvh tracks the
          // current visible viewport instead.
          height: `${heightVh * 100}dvh`,
          maxHeight: `${heightVh * 100}vh`,
          background: PANEL_BG,
          borderTop: `1px solid ${BORDER}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: open ? "0 -6px 24px rgba(0,0,0,0.14)" : undefined,
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag handle (visual only for now; close via header X or backdrop) */}
        <div
          style={{
            paddingTop: 8,
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "#d4d4d8",
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </>
  );
}
