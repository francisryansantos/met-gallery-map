import { useMemo, useState } from "react";
import type { EssaysData, EssayPeriodEntry } from "../types";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import {
  BORDER,
  FONT_DISPLAY,
  HOVER_BG,
  MET_RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme";

export interface GalleryRef {
  galleryNumber: string;
  galleryName: string;
  n: number;
}

interface EssaysViewProps {
  data: EssaysData;
  selectedPeriod: string | null;          // null = all periods (still grouped)
  /** Map of essay_id -> on-view galleries containing its cited objects. */
  essayToGalleries: Map<string, GalleryRef[]>;
  onJumpToGallery: (galleryNumber: string) => void;
}

const ESSAYS_PER_PERIOD_INITIAL = 8;
const MAX_GALLERY_CHIPS = 6;

export default function EssaysView({
  data,
  selectedPeriod,
  essayToGalleries,
  onJumpToGallery,
}: EssaysViewProps) {
  // Build the ordered list of (period_id, essay_ids) groups to render.
  const groups = useMemo(() => {
    const order: { id: string; label: string; essayIds: string[] }[] = [];
    for (const p of data.periods) {
      if (selectedPeriod && selectedPeriod !== p.id) continue;
      const ids = data.by_period[p.id] || [];
      if (ids.length > 0) {
        order.push({ id: p.id, label: p.label, essayIds: ids });
      }
    }
    // Always show unassigned last when filter is off; hide when filter is on.
    if (!selectedPeriod) {
      const unassigned = data.by_period["unassigned"] || [];
      if (unassigned.length > 0) {
        order.push({
          id: "unassigned",
          label: "Unassigned (cited objects not in this database)",
          essayIds: unassigned,
        });
      }
    }
    return order;
  }, [data, selectedPeriod]);

  const totalShown = groups.reduce((s, g) => s + g.essayIds.length, 0);

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: TEXT_MUTED,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {totalShown.toLocaleString()} essay{totalShown === 1 ? "" : "s"} ·
        Heilbrunn Timeline of Art History
        {selectedPeriod
          ? ` · ${data.periods.find((p) => p.id === selectedPeriod)?.label ?? selectedPeriod}`
          : " · grouped by period"}
      </div>

      {groups.map((g) => (
        <PeriodSection
          key={g.id}
          group={g}
          byEssay={data.by_essay}
          essayToGalleries={essayToGalleries}
          onJumpToGallery={onJumpToGallery}
        />
      ))}
    </div>
  );
}

function PeriodSection({
  group,
  byEssay,
  essayToGalleries,
  onJumpToGallery,
}: {
  group: { id: string; label: string; essayIds: string[] };
  byEssay: Record<string, EssayPeriodEntry>;
  essayToGalleries: Map<string, GalleryRef[]>;
  onJumpToGallery: (galleryNumber: string) => void;
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [expanded, setExpanded] = useState(false);

  // Sort essays inside the bucket by median_year (ascending), then by title
  const sorted = useMemo(() => {
    return group.essayIds
      .map((id) => ({ id, info: byEssay[id] }))
      .filter((x) => x.info)
      .sort((a, b) => {
        const ay = a.info.median_year ?? Number.POSITIVE_INFINITY;
        const by = b.info.median_year ?? Number.POSITIVE_INFINITY;
        if (ay !== by) return ay - by;
        return a.info.title.localeCompare(b.info.title);
      });
  }, [group.essayIds, byEssay]);

  const visible = expanded ? sorted : sorted.slice(0, ESSAYS_PER_PERIOD_INITIAL);
  const hidden = sorted.length - visible.length;

  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          borderBottom: `1px solid ${BORDER}`,
          paddingBottom: 6,
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: -0.1,
            color: TEXT_PRIMARY,
          }}
        >
          {group.label}
        </h3>
        <span style={{ fontSize: 12, color: TEXT_MUTED }}>
          {sorted.length} essay{sorted.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {visible.map(({ id, info }, i) => {
          const galleries = essayToGalleries.get(id) ?? [];
          return (
            <li
              key={id}
              style={{
                borderTop: i === 0 ? `1px solid ${BORDER}` : "none",
                borderBottom: `1px solid ${BORDER}`,
                padding: "7px 4px",
                transition: "background 0.08s",
              }}
              onMouseEnter={(ev) =>
                (ev.currentTarget.style.backgroundColor = HOVER_BG)
              }
              onMouseLeave={(ev) =>
                (ev.currentTarget.style.backgroundColor = "transparent")
              }
            >
              {/* Primary row: title / authors / pub year.
                  Desktop: single row, authors right-aligned, year rightmost.
                  Mobile: stack — title row 1, authors + year row 2 (smaller). */}
              {isMobile ? (
                <>
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      lineHeight: 1.35,
                      textDecoration: "none",
                    }}
                  >
                    {info.title}
                  </a>
                  {(info.authors.length > 0 || info.published) && (
                    <div
                      style={{
                        marginTop: 2,
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        fontSize: 11.5,
                        color: TEXT_MUTED,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={info.authors.join(", ")}
                      >
                        {info.authors.join(", ")}
                      </span>
                      {info.published && (
                        <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {info.published.slice(0, 4)}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                  }}
                >
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      lineHeight: 1.35,
                      textDecoration: "none",
                    }}
                  >
                    {info.title}
                  </a>
                  {info.authors.length > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        color: TEXT_SECONDARY,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 280,
                        flexShrink: 0,
                      }}
                      title={info.authors.join(", ")}
                    >
                      {info.authors.join(", ")}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: TEXT_MUTED,
                      fontVariantNumeric: "tabular-nums",
                      width: 36,
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {info.published ? info.published.slice(0, 4) : ""}
                  </span>
                </div>
              )}
              {/* Secondary row: visit-galleries chips */}
              {galleries.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: TEXT_MUTED,
                      letterSpacing: 0.3,
                      textTransform: "uppercase",
                      marginRight: 2,
                    }}
                  >
                    Visit
                  </span>
                  {galleries.slice(0, MAX_GALLERY_CHIPS).map((gref) => (
                    <button
                      key={gref.galleryNumber}
                      onClick={() => onJumpToGallery(gref.galleryNumber)}
                      title={`${gref.galleryName} · cites ${gref.n} object${gref.n === 1 ? "" : "s"} here`}
                      style={{
                        padding: "3px 9px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: TEXT_SECONDARY,
                        background: "transparent",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 999,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontVariantNumeric: "tabular-nums",
                        transition: "background 0.1s, color 0.1s, border-color 0.1s",
                      }}
                      onMouseEnter={(ev) => {
                        ev.currentTarget.style.background = "#fff";
                        ev.currentTarget.style.color = MET_RED;
                        ev.currentTarget.style.borderColor = MET_RED;
                      }}
                      onMouseLeave={(ev) => {
                        ev.currentTarget.style.background = "transparent";
                        ev.currentTarget.style.color = TEXT_SECONDARY;
                        ev.currentTarget.style.borderColor = BORDER;
                      }}
                    >
                      {gref.galleryNumber}
                    </button>
                  ))}
                  {galleries.length > MAX_GALLERY_CHIPS && (
                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                      +{galleries.length - MAX_GALLERY_CHIPS} more
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 10,
            background: "none",
            border: "none",
            padding: 0,
            color: MET_RED,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Show {hidden} more →
        </button>
      )}
      {expanded && sorted.length > ESSAYS_PER_PERIOD_INITIAL && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 10,
            background: "none",
            border: "none",
            padding: 0,
            color: TEXT_MUTED,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Show less
        </button>
      )}
    </section>
  );
}
