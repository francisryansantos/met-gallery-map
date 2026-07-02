import { useEffect, useMemo, useState } from "react";
import type { Gallery } from "../types";
import {
  type FloorKey,
  MAP_BG,
  MET_RED,
  RADIUS_PANEL,
  matchesFloor,
} from "../theme";

interface PdfPosition {
  num: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: number | null;
}

interface PdfPositionsFile {
  page: { width: number; height: number };
  positions: Record<string, PdfPosition>;
}

interface MapViewProps {
  galleries: Record<string, Gallery>;
  // Either a single floor key, or a list of floors to render on the same
  // canvas. PDF positions for different floors are in the same coordinate
  // space but don't spatially overlap, so they composite naturally.
  floor: FloorKey | FloorKey[];
  floorLabel: string;
  selectedGallery: string | null;
  /** Optional gallery to pulse momentarily so the user can locate it
   * (used after mobile "View on map" closes the bottom sheet). */
  pulseGalleryNumber?: string | null;
  onSelectGallery: (galleryNumber: string) => void;
}

const EMPTY_FILL = "#ece9da";
const EMPTY_STROKE = "#bdbab0";
const FALLBACK_FILL = "#f5f4ee";
const FALLBACK_STROKE = "#9a9a90";
const PADDING = 36;
const CELL_W = 16;
const CELL_H = 12;

const DEPT_PALETTE: Record<string, { fill: string; stroke: string }> = {
  "The American Wing": { fill: "#f4e6c2", stroke: "#a87f30" },
  "European Sculpture and Decorative Arts": {
    fill: "#ead6e8",
    stroke: "#8e609a",
  },
  "Asian Art": { fill: "#cae5b8", stroke: "#6a9648" },
  "European Paintings": { fill: "#c4d4ea", stroke: "#4f7ab0" },
  "Egyptian Art": { fill: "#f0dca8", stroke: "#a8821c" },
  "Arms and Armor": { fill: "#d2d2d2", stroke: "#7a7a7a" },
  "Greek and Roman Art": { fill: "#e6d8b0", stroke: "#9a8848" },
  "The Michael C. Rockefeller Wing": {
    fill: "#eac8a0",
    stroke: "#a66c34",
  },
  "Robert Lehman Collection": { fill: "#c8d4ea", stroke: "#5070a0" },
  "Islamic Art": { fill: "#ead0a8", stroke: "#a47030" },
  "Drawings and Prints": { fill: "#dad6c4", stroke: "#85775c" },
  "Medieval Art": { fill: "#c4dede", stroke: "#3a7878" },
  "Modern and Contemporary Art": {
    fill: "#ecc4c4",
    stroke: "#a04848",
  },
  Photographs: { fill: "#d2d2bc", stroke: "#6a6a48" },
  "Musical Instruments": { fill: "#d6c0ea", stroke: "#6e44a8" },
  "Costume Institute": { fill: "#eac0d2", stroke: "#9c3c70" },
  "The Cloisters": { fill: "#dcd2bc", stroke: "#7a6c44" },
};

function deptColors(department: string | null) {
  if (!department) return { fill: FALLBACK_FILL, stroke: FALLBACK_STROKE };
  return (
    DEPT_PALETTE[department] ?? { fill: FALLBACK_FILL, stroke: FALLBACK_STROKE }
  );
}

interface PlacedCell {
  num: string;
  gallery: Gallery;
  x: number;
  y: number;
  isEmpty: boolean;
}

export default function MapView({
  galleries,
  floor,
  floorLabel,
  selectedGallery,
  pulseGalleryNumber,
  onSelectGallery,
}: MapViewProps) {
  const [pdf, setPdf] = useState<PdfPositionsFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/pdf_positions.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setPdf)
      .catch((e) => setError(e.message));
  }, []);

  const placed = useMemo<PlacedCell[]>(() => {
    if (!pdf) return [];
    const out: PlacedCell[] = [];
    for (const [num, pos] of Object.entries(pdf.positions)) {
      const g = galleries[num];
      if (!g) continue;
      const floorList = Array.isArray(floor) ? floor : [floor];
      if (!floorList.some((f) => matchesFloor(g.floor ?? null, f))) continue;
      if (g.lat != null && g.lat > 40.85) continue;
      out.push({
        num,
        gallery: g,
        x: pos.x,
        y: pos.y,
        isEmpty: g.object_count === 0,
      });
    }
    return out;
  }, [pdf, galleries, floor]);


  // Build a legend from the departments present on this floor, but only
  // include departments that have a defined color in DEPT_PALETTE (skip
  // fallback-gray entries — those add noise without conveying anything).
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of placed) {
      const d = p.gallery.department;
      if (!d) continue;
      if (!(d in DEPT_PALETTE)) continue;
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [placed]);

  if (error) {
    return (
      <div style={{ padding: 24, color: "#666" }}>
        Couldn’t load PDF positions: {error}.<br />
        Run <code>python3 data/extract_pdf_positions.py</code>.
      </div>
    );
  }
  if (!pdf) {
    return <div style={{ padding: 24, color: "#888" }}>Loading map…</div>;
  }
  if (placed.length === 0) {
    return (
      <div style={{ padding: 24, color: "#666" }}>
        No galleries on this floor have PDF positions.
      </div>
    );
  }

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxX = Math.max(...xs) + PADDING;
  const maxY = Math.max(...ys) + PADDING;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: MET_RED,
          marginBottom: 12,
        }}
      >
        {floorLabel}
      </div>

      <svg
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: MAP_BG,
          borderRadius: RADIUS_PANEL,
        }}
      >
        {placed.map((cell) => {
          const isSelected = selectedGallery === cell.num;
          const colors = deptColors(cell.gallery.department);
          const fill = isSelected
            ? MET_RED
            : cell.isEmpty
              ? EMPTY_FILL
              : colors.fill;
          const stroke = isSelected
            ? "#8b1425"
            : cell.isEmpty
              ? EMPTY_STROKE
              : colors.stroke;
          return (
            <g
              key={cell.num}
              onClick={
                cell.isEmpty ? undefined : () => onSelectGallery(cell.num)
              }
              style={{ cursor: cell.isEmpty ? "default" : "pointer" }}
            >
              <rect
                x={cell.x - CELL_W / 2}
                y={cell.y - CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 0.8 : 0.4}
                strokeDasharray={cell.isEmpty ? "0.8 0.6" : undefined}
              >
                <title>
                  Gallery {cell.num}: {cell.gallery.name}
                  {cell.gallery.department
                    ? ` · ${cell.gallery.department}`
                    : ""}
                  {cell.isEmpty
                    ? " · no objects in our data"
                    : ` · ${cell.gallery.object_count} objects`}
                </title>
              </rect>
              <text
                x={cell.x}
                y={cell.y + 2.2}
                textAnchor="middle"
                fontSize={5.5}
                fontWeight={500}
                fill={isSelected ? "#fff" : cell.isEmpty ? "#999" : "#222"}
                fontFamily="inherit"
                pointerEvents="none"
              >
                {cell.num}
              </text>
            </g>
          );
        })}
        {/* Pulse ring overlay — shown on top of all cells so it isn't covered
            by neighbors. The matching cell already has the red selection fill;
            this adds two animated concentric rings to draw the eye. */}
        {pulseGalleryNumber &&
          (() => {
            const target = placed.find((c) => c.num === pulseGalleryNumber);
            if (!target) return null;
            const r = Math.max(CELL_W, CELL_H) * 0.9;
            return (
              <g pointerEvents="none">
                <circle
                  cx={target.x}
                  cy={target.y}
                  r={r}
                  fill="none"
                  stroke={MET_RED}
                  strokeWidth={1}
                  opacity={0.9}
                >
                  <animate
                    attributeName="r"
                    from={r * 0.6}
                    to={r * 2.2}
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.9"
                    to="0"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={target.x}
                  cy={target.y}
                  r={r}
                  fill="none"
                  stroke={MET_RED}
                  strokeWidth={1}
                  opacity={0.6}
                >
                  <animate
                    attributeName="r"
                    from={r * 0.6}
                    to={r * 2.2}
                    dur="1.4s"
                    begin="0.7s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.6"
                    to="0"
                    dur="1.4s"
                    begin="0.7s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })()}
      </svg>

      {/* Department legend */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          fontSize: 11,
          color: "#444",
        }}
      >
        {legend.map(([dept, count]) => {
          const colors = deptColors(dept);
          return (
            <div
              key={dept}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 10,
                  background: colors.fill,
                  border: `1px solid ${colors.stroke}`,
                }}
              />
              <span>
                {dept}{" "}
                <span style={{ color: "#888" }}>({count})</span>
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "12px 4px 0",
          fontSize: 11,
          color: "#5a5e3e",
          letterSpacing: 0.2,
        }}
      >
        {placed.length} galleries · {legend.length} departments
      </div>
    </div>
  );
}
