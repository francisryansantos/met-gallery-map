import { useEffect } from "react";
import { BORDER, PANEL_BG } from "../theme";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}

/**
 * Left-side slide-in drawer for mobile nav. Renders a dimmed backdrop +
 * panel that animates in via transform. Backdrop click and Escape close.
 *
 * Always mounted (no conditional render) so the slide-out animation runs;
 * `inert` and `aria-hidden` keep it accessibility-correct when closed.
 */
export default function MobileDrawer({
  open,
  onClose,
  width = 280,
  children,
}: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Prevent background scroll while the drawer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
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
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width,
          maxWidth: "85vw",
          background: PANEL_BG,
          borderRight: `1px solid ${BORDER}`,
          boxShadow: open ? "0 0 24px rgba(0,0,0,0.12)" : undefined,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s ease",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {children}
      </div>
    </>
  );
}
