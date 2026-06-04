export type FloorKey = 0 | 1 | 2 | 3 | "other";

// Brand accent — used sparingly for active states, key actions, and the
// "Met" attribution. Avoid stamping it on every header.
export const MET_RED = "#c8102e";

// App backgrounds. Neutral cool gray reads as modern + lets accents pop.
export const APP_BG = "#f5f5f7";          // page background
export const PANEL_BG = "#ffffff";        // cards, panels
export const SOFT_BG = "#fafafb";         // very subtly tinted sections

// Text scale (warm-tinted darks, mid for secondary, light for metadata).
export const TEXT_PRIMARY = "#111114";
export const TEXT_SECONDARY = "#5b6066";
export const TEXT_MUTED = "#9aa0a6";

// Borders/dividers — hairlines, not heavy lines.
export const BORDER = "#e4e4e7";
export const BORDER_STRONG = "#d4d4d8";
export const HOVER_BG = "#f3f3f5";
export const ACTIVE_TINT = "#fff0f2";   // very pale red wash for active rows

// Floor-plan map background. Light cool gray reads as neutral architectural
// space and lets the pastel gallery cells pop without competing.
export const MAP_BG = "#e8eaed";

// Legacy aliases kept so existing imports continue to work.
export const SAGE_BG = APP_BG;
export const CANVAS_BG = PANEL_BG;

export function matchesFloor(
  galleryFloor: number | null,
  key: FloorKey
): boolean {
  if (key === "other") return galleryFloor === null;
  return galleryFloor === key;
}
