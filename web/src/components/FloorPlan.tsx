import { useMemo } from "react";
import type { Gallery } from "../types";
import { curatorialCompare } from "../departments";
import {
  BORDER,
  FONT_DISPLAY,
  MET_RED,
  PANEL_BG,
  RADIUS_CARD,
  RADIUS_THUMB,
  SOFT_BG,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme";

interface FloorPlanProps {
  galleries: Record<string, Gallery>;
  selectedGallery: string | null;
  onSelectGallery: (galleryNumber: string) => void;
}


interface FloorGroup {
  floor: number | null;
  galleries: [string, Gallery][];
}

interface Section {
  department: string;
  galleries: [string, Gallery][];    // flat (for ordering / counts)
  floorGroups: FloorGroup[];          // grouped (for render)
}

const UNASSIGNED = "Other / Unassigned";

// Stable sort by numeric gallery number (falling back to string compare).
function byNumber(a: [string, Gallery], b: [string, Gallery]): number {
  const an = parseInt(a[0]);
  const bn = parseInt(b[0]);
  if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
  return a[0].localeCompare(b[0]);
}

function floorLabel(floor: number | null): string {
  if (floor === 0) return "Ground floor";
  if (floor == null) return "Floor unknown";
  return `Floor ${floor}`;
}

export function deptSlug(department: string): string {
  return "dept-" + department.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Order floors as a visitor would walk them: Ground, 1, 2, 3, ..., then
// unknown last so it doesn't break the visual flow.
function floorSortKey(floor: number | null): number {
  return floor == null ? Number.POSITIVE_INFINITY : floor;
}

function groupByDepartment(entries: [string, Gallery][]): Section[] {
  const groups = new Map<string, [string, Gallery][]>();
  for (const e of entries) {
    const dept = e[1].department || UNASSIGNED;
    if (!groups.has(dept)) groups.set(dept, []);
    groups.get(dept)!.push(e);
  }
  const sections: Section[] = [...groups.entries()].map(([department, gs]) => {
    const sorted = gs.sort(byNumber);
    // Sub-group by floor; preserve numeric gallery order inside each floor.
    const floorMap = new Map<number | null, [string, Gallery][]>();
    for (const e of sorted) {
      const f = e[1].floor ?? null;
      if (!floorMap.has(f)) floorMap.set(f, []);
      floorMap.get(f)!.push(e);
    }
    const floorGroups = [...floorMap.entries()]
      .map(([floor, gs]) => ({ floor, galleries: gs }))
      .sort((a, b) => floorSortKey(a.floor) - floorSortKey(b.floor));
    return { department, galleries: sorted, floorGroups };
  });
  // Order sections by the Met's published curatorial department order so
  // the TOC and the FloorPlan list agree.
  sections.sort((a, b) => curatorialCompare(a.department, b.department));
  return sections;
}

export default function FloorPlan({
  galleries,
  selectedGallery,
  onSelectGallery,
}: FloorPlanProps) {
  const { sections, withObjectsCount, emptyCount } = useMemo(() => {
    const all = Object.entries(galleries).filter(([, g]) => {
      // Fifth Avenue building only (exclude The Met Cloisters at lat ~40.86).
      if (g.lat != null && g.lat > 40.85) return false;
      // List view only shows accessible galleries — empty placeholders stay
      // in the data so they still render as grayed cells on the map.
      if (g.object_count === 0) return false;
      return true;
    });
    const withObjectsCount = all.filter(([, g]) => g.object_count > 0).length;
    const emptyCount = all.length - withObjectsCount;
    return {
      sections: groupByDepartment(all),
      withObjectsCount,
      emptyCount,
    };
  }, [galleries]);

  if (sections.length === 0) {
    return (
      <div style={{ padding: 24, color: "#666" }}>
        No galleries match the current filter.
      </div>
    );
  }

  return (
    <div>
      {sections.map((section) => {
        const sectionObjects = section.galleries.reduce(
          (s, [, g]) => s + g.object_count,
          0
        );
        return (
          <section
            key={section.department}
            id={deptSlug(section.department)}
            style={{ marginBottom: 32, scrollMarginTop: 24 }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                paddingBottom: 8,
                marginBottom: 12,
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 20,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  letterSpacing: -0.1,
                }}
              >
                {section.department}
              </h2>
              <span
                style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {section.galleries.length} galleries ·{" "}
                {sectionObjects.toLocaleString()} objects
              </span>
            </header>

            {section.floorGroups.map((fg) => {
              const showFloorHeader = section.floorGroups.length > 1;
              return (
                <div key={fg.floor ?? "unknown"} style={{ marginBottom: 16 }}>
                  {showFloorHeader && (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: TEXT_MUTED,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        margin: "0 0 8px",
                      }}
                    >
                      {floorLabel(fg.floor)}
                      <span style={{ fontWeight: 400, marginLeft: 6 }}>
                        · {fg.galleries.length} galler
                        {fg.galleries.length === 1 ? "y" : "ies"}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))",
                      gap: 8,
                    }}
                  >
                    {fg.galleries.map(([num, g]) => {
                      const isSelected = selectedGallery === num;
                      const isEmpty = g.object_count === 0;
                      const thumb = g.objects.find((o) => o.image)?.image;
                      return (
                        <button
                          key={num}
                          id={`gallery-card-${num}`}
                          onClick={isEmpty ? undefined : () => onSelectGallery(num)}
                          disabled={isEmpty}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: 8,
                            borderWidth: isSelected ? 1.5 : 1,
                            borderColor: isSelected ? MET_RED : BORDER,
                            scrollMarginTop: 16,
                            background: isSelected
                              ? "#fbeeee"
                              : isEmpty
                                ? "transparent"
                                : PANEL_BG,
                            color: isEmpty ? TEXT_MUTED : TEXT_PRIMARY,
                            borderRadius: RADIUS_CARD,
                            fontSize: 13,
                            cursor: isEmpty ? "default" : "pointer",
                            textAlign: "left",
                            width: "100%",
                            borderStyle: isEmpty ? "dashed" : "solid",
                            transition: "background 0.12s, border-color 0.12s",
                          }}
                          onMouseEnter={(ev) => {
                            if (!isSelected && !isEmpty) {
                              ev.currentTarget.style.background = SOFT_BG;
                              ev.currentTarget.style.borderColor = "#cdc5b6";
                            }
                          }}
                          onMouseLeave={(ev) => {
                            if (!isSelected && !isEmpty) {
                              ev.currentTarget.style.background = PANEL_BG;
                              ev.currentTarget.style.borderColor = BORDER;
                            }
                          }}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: 52,
                                height: 52,
                                objectFit: "cover",
                                borderRadius: RADIUS_THUMB,
                                flexShrink: 0,
                                display: "block",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: RADIUS_THUMB,
                                flexShrink: 0,
                                background: SOFT_BG,
                                border: `1px solid ${BORDER}`,
                                boxSizing: "border-box",
                              }}
                            />
                          )}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 10.5,
                                fontWeight: 600,
                                letterSpacing: 0.5,
                                textTransform: "uppercase",
                                color: isSelected ? MET_RED : TEXT_MUTED,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              Gallery {num}
                            </span>
                            <span
                              style={{
                                display: "block",
                                marginTop: 2,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                                fontWeight: 500,
                              }}
                            >
                              {g.name}
                            </span>
                          </span>
                          {!isEmpty && (
                            <span
                              style={{
                                fontSize: 11,
                                color: TEXT_MUTED,
                                fontVariantNumeric: "tabular-nums",
                                alignSelf: "flex-start",
                                marginTop: 2,
                                marginRight: 4,
                              }}
                            >
                              {g.object_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <div
        style={{
          padding: "12px 4px 0",
          fontSize: 11.5,
          color: TEXT_MUTED,
        }}
      >
        {withObjectsCount} galleries with on-view objects
        {emptyCount > 0 ? ` · ${emptyCount} empty (dashed)` : ""}
      </div>
    </div>
  );
}
