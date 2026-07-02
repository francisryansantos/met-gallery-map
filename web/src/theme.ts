export type FloorKey = 0 | 1 | 2 | 3 | "other";

// Brand accent — used sparingly for active states, key actions, and the
// "Met" attribution. Avoid stamping it on every header.
export const MET_RED = "#c8102e";

// Display face for headings — editorial serif against DM Sans UI text.
export const FONT_DISPLAY =
  '"Fraunces", "Iowan Old Style", "Palatino Linotype", Georgia, serif';

// App backgrounds. Warm paper/ivory flatters artwork photography (which
// mostly sits on warm-gray museum backdrops) and reads gallery-catalog
// rather than dashboard.
export const APP_BG = "#f6f3ec";          // page background (warm paper)
export const PANEL_BG = "#fffefb";        // cards, panels (warm white)
export const SOFT_BG = "#faf8f2";         // very subtly tinted sections

// Text scale (warm-tinted darks, mid for secondary, light for metadata).
export const TEXT_PRIMARY = "#1d1a16";
export const TEXT_SECONDARY = "#5f5a51";
export const TEXT_MUTED = "#a19a8d";

// Borders/dividers — hairlines, not heavy lines.
export const BORDER = "#e7e1d5";
export const BORDER_STRONG = "#d6cfc1";
export const HOVER_BG = "#f3efe6";
export const ACTIVE_TINT = "#fbeeee";   // very pale red wash for active rows

// Floor-plan map background. Light warm gray reads as neutral architectural
// space and lets the pastel gallery cells pop without competing.
export const MAP_BG = "#ebe7de";

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
