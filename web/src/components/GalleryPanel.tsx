import { useEffect, useRef, useState } from "react";
import type { Gallery, EssayLink, MetObject } from "../types";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import {
  ACTIVE_TINT,
  BORDER,
  FONT_DISPLAY,
  HOVER_BG,
  MET_RED,
  SOFT_BG,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme";

const INITIAL_ESSAYS_VISIBLE = 3;
const MAX_FACET_CHIPS = 8;

function facetCounts(
  objects: MetObject[],
  pick: (o: MetObject) => string | null
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const o of objects) {
    const v = pick(o);
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

interface EssayFilter {
  essayId: string;
  objectIds: Set<number>;
}

interface GalleryPanelProps {
  galleryNumber: string;
  gallery: Gallery;
  // Single object to scroll-and-pulse (from SearchBox). Doesn't hide the rest.
  pulseObjectId: number | null;
  // When set, the panel renders only objects whose id is in `objectIds`,
  // and the row matching `essayId` is the one shown as active.
  essayFilter: EssayFilter | null;
  onSetEssayFilter: (filter: EssayFilter | null) => void;
  onShowOnMap?: () => void;
  onClose: () => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23eceadf'%3E%3Crect width='200' height='200'/%3E%3Ctext x='100' y='108' text-anchor='middle' font-size='13' fill='%23a8a89c' font-family='Helvetica,sans-serif'%3ENo image%3C/text%3E%3C/svg%3E";

export default function GalleryPanel({
  galleryNumber,
  gallery,
  pulseObjectId,
  essayFilter,
  onSetEssayFilter,
  onShowOnMap,
  onClose,
}: GalleryPanelProps) {
  const scrollTargetRef = useRef<HTMLAnchorElement | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // In-gallery facet filters. Multi-select within a facet (OR); AND across
  // facets. Empty set = no filter on that facet.
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  const [cultureFilter, setCultureFilter] = useState<Set<string>>(new Set());

  // Clear in-gallery facets whenever the open gallery changes or an essay
  // filter is applied (essay filter has primacy over facet filters).
  useEffect(() => {
    setClassFilter(new Set());
    setCultureFilter(new Set());
  }, [galleryNumber, essayFilter]);

  // Apply essay filter first (if active), then in-gallery facet filters.
  const visibleObjects = (
    essayFilter
      ? gallery.objects.filter((o) => essayFilter.objectIds.has(o.id))
      : gallery.objects
  ).filter((o) => {
    if (classFilter.size > 0 && (!o.classification || !classFilter.has(o.classification))) return false;
    if (cultureFilter.size > 0 && (!o.culture || !cultureFilter.has(o.culture))) return false;
    return true;
  });

  // Facet options derived from the active (essay-filtered) object set so a
  // facet doesn't suggest values that aren't reachable.
  const facetSource = essayFilter
    ? gallery.objects.filter((o) => essayFilter.objectIds.has(o.id))
    : gallery.objects;
  const classCounts = facetCounts(facetSource, (o) => o.classification);
  const cultureCounts = facetCounts(facetSource, (o) => o.culture);
  const hasAnyFacetFilter = classFilter.size > 0 || cultureFilter.size > 0;

  // Scroll-and-pulse a single object when SearchBox routes here.
  useEffect(() => {
    if (pulseObjectId == null) {
      setPulsing(false);
      return;
    }
    const t = setTimeout(() => {
      scrollTargetRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
    setPulsing(true);
    const fade = setTimeout(() => setPulsing(false), 2400);
    return () => {
      clearTimeout(t);
      clearTimeout(fade);
    };
  }, [pulseObjectId, galleryNumber]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: isMobile ? "10px 16px 12px" : "18px 22px 14px",
          borderBottom: "1px solid #e4e4e7",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: MET_RED,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Gallery {galleryNumber}
            </div>
            <h2
              style={{
                margin: "4px 0 0",
                fontFamily: FONT_DISPLAY,
                fontSize: isMobile ? 19 : 23,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                letterSpacing: -0.2,
                lineHeight: 1.2,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {gallery.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #d4d4d8",
              borderRadius: 6,
              minWidth: 36,
              minHeight: 36,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 14,
              color: TEXT_SECONDARY,
              flexShrink: 0,
            }}
            aria-label="Close gallery"
          >
            ✕
          </button>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: TEXT_MUTED,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {gallery.department && (
            <span style={{ color: TEXT_SECONDARY, fontWeight: 600 }}>
              {gallery.department}
            </span>
          )}
          <span>{gallery.object_count} objects on view</span>
          {onShowOnMap && (
            <button
              onClick={onShowOnMap}
              style={{
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
              View on map →
            </button>
          )}
        </div>
      </div>

      {/* Single scrolling region for essays + filter status + object grid.
          Previously the essays section was outside this scroller, so expanding
          its "Show more" pushed the object grid below the viewport. Now
          everything scrolls together; only the header stays pinned. */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          scrollbarGutter: "stable",
        }}
      >
        {/* Essays section (only if any essays reference objects in this gallery) */}
        {gallery.essays && gallery.essays.length > 0 && (
          <EssaysSection
            essays={gallery.essays}
            activeEssayId={essayFilter?.essayId ?? null}
            onSelectEssay={(essay) =>
              onSetEssayFilter(
                essay
                  ? { essayId: essay.essay_id, objectIds: new Set(essay.object_ids) }
                  : null
              )
            }
          />
        )}

        {/* Active-filter status (sticky so it stays visible as you scroll). */}
        {essayFilter && (
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              padding: "8px 22px",
              background: "#fff0f2",
              borderBottom: "1px solid #e4e4e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 12,
              color: TEXT_SECONDARY,
            }}
          >
            <span>
              Showing {visibleObjects.length} of {gallery.object_count} object
              {gallery.object_count === 1 ? "" : "s"} cited by this essay
            </span>
            <button
              onClick={() => onSetEssayFilter(null)}
              style={{
                background: "none",
                border: "none",
                color: MET_RED,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 6px",
              }}
            >
              Show all
            </button>
          </div>
        )}

        {/* Facet filters (classification, culture). Only render when there are
            ≥2 distinct values for a facet — single-value facets are noise. */}
        {(classCounts.length >= 2 || cultureCounts.length >= 2) && (
          <div
            style={{
              padding: "10px 22px 6px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {classCounts.length >= 2 && (
              <FacetRow
                label="Type"
                options={classCounts}
                selected={classFilter}
                onToggle={(v) =>
                  setClassFilter((prev) => toggleInSet(prev, v))
                }
              />
            )}
            {cultureCounts.length >= 2 && (
              <FacetRow
                label="Culture"
                options={cultureCounts}
                selected={cultureFilter}
                onToggle={(v) =>
                  setCultureFilter((prev) => toggleInSet(prev, v))
                }
              />
            )}
            {hasAnyFacetFilter && (
              <button
                onClick={() => {
                  setClassFilter(new Set());
                  setCultureFilter(new Set());
                }}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  color: MET_RED,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 0 0",
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Object grid */}
        <div
          style={{
            padding: "14px 18px 22px 22px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {visibleObjects.map((obj) => {
            const isPulseTarget = obj.id === pulseObjectId;
            return (
            <a
              key={obj.id}
              ref={isPulseTarget ? scrollTargetRef : undefined}
              href={obj.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <div
                style={{
                  border: isPulseTarget
                    ? `2px solid ${MET_RED}`
                    : "1px solid #e4e4e7",
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "#fff",
                  transition: "box-shadow 0.15s, transform 0.15s",
                  boxShadow:
                    isPulseTarget && pulsing
                      ? `0 0 0 4px rgba(200,16,46,0.25)`
                      : undefined,
                  animation:
                    isPulseTarget && pulsing ? "metPulse 1.2s ease-in-out 2" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isPulseTarget) {
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPulseTarget) {
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <img
                  src={obj.image || PLACEHOLDER}
                  alt={obj.title}
                  style={{
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    display: "block",
                    backgroundColor: "#f3f3f5",
                  }}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER;
                  }}
                />
                <div style={{ padding: "8px 10px 10px" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#111114",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {obj.title}
                  </div>
                  {obj.artist && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: TEXT_SECONDARY,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={
                        obj.artist_bio
                          ? `${obj.artist} — ${obj.artist_bio}`
                          : obj.artist
                      }
                    >
                      {obj.artist}
                    </div>
                  )}
                  {obj.culture && (
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_MUTED,
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {obj.culture}
                    </div>
                  )}
                  {obj.period && (
                    <div
                      style={{
                        fontSize: 10,
                        color: TEXT_MUTED,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {obj.period}
                    </div>
                  )}
                </div>
              </div>
            </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EssaysSection({
  essays,
  activeEssayId,
  onSelectEssay,
}: {
  essays: EssayLink[];
  activeEssayId: string | null;
  // Pass the essay itself (or null to clear). Identity-based, not citation-set
  // based — two essays citing the same objects no longer both highlight.
  onSelectEssay: (essay: EssayLink | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? essays : essays.slice(0, INITIAL_ESSAYS_VISIBLE);
  const hidden = essays.length - visible.length;

  return (
    <div
      style={{
        padding: "8px 22px 8px",
        borderBottom: "1px solid #e4e4e7",
        backgroundColor: SOFT_BG,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: MET_RED,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Essays
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED }}>
          {essays.length} from the Heilbrunn Timeline
        </div>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {visible.map((e) => {
          const active = e.essay_id === activeEssayId;
          return (
            <li
              key={e.essay_id}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 6,
              }}
            >
              {/* Main click target: highlight this essay's objects */}
              <button
                onClick={() => onSelectEssay(active ? null : e)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  padding: "3px 7px",
                  borderRadius: 3,
                  background: active ? ACTIVE_TINT : "transparent",
                  border: active ? `1px solid ${MET_RED}` : "1px solid transparent",
                  color: TEXT_PRIMARY,
                  cursor: "pointer",
                  fontSize: 12.5,
                  lineHeight: 1.25,
                  fontFamily: "inherit",
                  transition: "background 0.1s, border-color 0.1s",
                }}
                onMouseEnter={(ev) => {
                  if (!active) {
                    ev.currentTarget.style.backgroundColor = HOVER_BG;
                    ev.currentTarget.style.borderColor = "#e4e4e7";
                  }
                }}
                onMouseLeave={(ev) => {
                  if (!active) {
                    ev.currentTarget.style.backgroundColor = "transparent";
                    ev.currentTarget.style.borderColor = "transparent";
                  }
                }}
                title={
                  active
                    ? "Click to clear highlight"
                    : `Highlight the ${e.object_ids.length} object${e.object_ids.length === 1 ? "" : "s"} this essay cites here`
                }
              >
                <div style={{ fontWeight: 500 }}>
                  {e.title}
                  {active && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10.5,
                        fontWeight: 500,
                        color: MET_RED,
                      }}
                    >
                      · click to clear
                    </span>
                  )}
                </div>
              </button>
              {/* Secondary action: open the essay on metmuseum.org */}
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open essay on metmuseum.org"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  borderRadius: 3,
                  color: TEXT_MUTED,
                  textDecoration: "none",
                  fontSize: 13,
                  border: "1px solid transparent",
                }}
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.color = MET_RED;
                  ev.currentTarget.style.borderColor = "#e4e4e7";
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.color = "#888";
                  ev.currentTarget.style.borderColor = "transparent";
                }}
              >
                ↗
              </a>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 8,
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
      {expanded && essays.length > INITIAL_ESSAYS_VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 8,
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
    </div>
  );
}

function toggleInSet<T>(s: Set<T>, v: T): Set<T> {
  const next = new Set(s);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

function FacetRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, MAX_FACET_CHIPS);
  const hidden = options.length - visible.length;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: TEXT_MUTED,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginRight: 2,
          minWidth: 50,
        }}
      >
        {label}
      </span>
      {visible.map(({ value, count }) => {
        const active = selected.has(value);
        return (
          <button
            key={value}
            onClick={() => onToggle(value)}
            title={value}
            style={{
              padding: "4px 10px",
              fontSize: 11.5,
              fontWeight: 500,
              border: "1px solid",
              borderColor: active ? MET_RED : BORDER,
              background: active ? MET_RED : "transparent",
              color: active ? "#fff" : TEXT_SECONDARY,
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "inherit",
              transition:
                "background 0.1s, color 0.1s, border-color 0.1s",
            }}
          >
            {value}
            <span
              style={{
                opacity: active ? 0.75 : 0.55,
                marginLeft: 5,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 400,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
      {hidden > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "none",
            border: "none",
            color: TEXT_MUTED,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}
