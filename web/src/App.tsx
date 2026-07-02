import { useEffect, useMemo, useRef, useState } from "react";
import FloorPlan from "./components/FloorPlan";
import GalleryPanel from "./components/GalleryPanel";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import DepartmentToc from "./components/DepartmentToc";
import EssaysView from "./components/EssaysView";
import MobileBottomSheet from "./components/MobileBottomSheet";
import MobileDrawer from "./components/MobileDrawer";
import { useMediaQuery, MOBILE_QUERY } from "./hooks/useMediaQuery";
import { useRoute } from "./router";
import type {
  EssaysData,
  GalleriesData,
  GalleryEssaysData,
} from "./types";
import FeaturedGallery from "./components/FeaturedGallery";
import {
  APP_BG,
  BORDER,
  BORDER_STRONG,
  FONT_DISPLAY,
  type FloorKey,
  MET_RED,
  PANEL_BG,
  RADIUS_CARD,
  RADIUS_PANEL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./theme";

// Map tabs. Floor 3 is folded into the Floor 2 tab (only 16 galleries up
// there, mostly contemporary — they sit visually above Floor 2 in the
// stacked render). Ground floor is omitted entirely; coverage is too sparse
// to be useful as a map.
const MAP_FLOORS: {
  key: number;
  label: string;
  renderFloors: FloorKey[];
}[] = [
  { key: 1, label: "Floor 1", renderFloors: [1] },
  { key: 2, label: "Floor 2", renderFloors: [2, 3] },
];

function App() {
  const [data, setData] = useState<GalleriesData | null>(null);
  const [essays, setEssays] = useState<EssaysData | null>(null);

  // Shareable / back-button-able state lives in the URL.
  const [route, setRoute] = useRoute();
  const appView = route.view;
  const viewMode = route.mode;
  const mapFloor = route.mapFloor;
  const selectedGallery = route.galleryNumber;

  // Transient state stays in React.
  const [pulseObjectId, setPulseObjectId] = useState<number | null>(null);
  // Gallery number to pulse on the map view briefly — used after "View on map"
  // closes the bottom sheet on mobile, so the user can locate where they were.
  const [pulseGalleryOnMap, setPulseGalleryOnMap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear the map pulse after a few seconds.
  useEffect(() => {
    if (!pulseGalleryOnMap) return;
    const t = setTimeout(() => setPulseGalleryOnMap(null), 5000);
    return () => clearTimeout(t);
  }, [pulseGalleryOnMap]);

  // Mobile structural switches.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [tocOpen, setTocOpen] = useState(false);

  // Scroll container for the gallery list. The active-section observer lives
  // inside DepartmentToc so scroll-induced state churn doesn't re-render
  // FloorPlan (449 cards) on every tick.
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  // When a gallery is opened (deep link, featured gallery, or any
  // router-driven navigation), scroll its card into view in the list. Use rAF to wait for
  // React to commit the matching card before measuring.
  useEffect(() => {
    if (!selectedGallery || viewMode !== "list") return;
    let raf = requestAnimationFrame(() => {
      const el = document.getElementById(`gallery-card-${selectedGallery}`);
      if (el) el.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedGallery, viewMode]);

  // Reverse index: essay_id -> [{galleryNumber, galleryName, n}]. Built once
  // from the gallery_essays data so EssaysView can show "Visit galleries: 162,
  // 304, 455" per essay. n = number of this essay's cited objects in that gallery.
  const essayToGalleries = useMemo(() => {
    const out = new Map<
      string,
      { galleryNumber: string; galleryName: string; n: number }[]
    >();
    if (!data) return out;
    for (const [gn, g] of Object.entries(data.galleries)) {
      if (!g.essays) continue;
      for (const e of g.essays) {
        const arr = out.get(e.essay_id) ?? [];
        arr.push({
          galleryNumber: gn,
          galleryName: g.name,
          n: e.object_ids.length,
        });
        out.set(e.essay_id, arr);
      }
    }
    // Sort each list: galleries with more cited objects first, then by number
    for (const arr of out.values()) {
      arr.sort(
        (a, b) =>
          b.n - a.n ||
          (parseInt(a.galleryNumber) || 0) - (parseInt(b.galleryNumber) || 0)
      );
    }
    return out;
  }, [data]);

  // Derive essayFilter from the route by looking up the active essay in the
  // currently-open gallery. The object_ids come from that lookup; the URL
  // only carries the essay_id.
  const essayFilter = useMemo(() => {
    if (!route.essayId || !selectedGallery || !data) return null;
    const g = data.galleries[selectedGallery];
    const e = g?.essays?.find((x) => x.essay_id === route.essayId);
    if (!e) return null;
    return { essayId: e.essay_id, objectIds: new Set(e.object_ids) };
  }, [route.essayId, selectedGallery, data]);

  useEffect(() => {
    Promise.all([
      fetch("/data/galleries.json").then((r) => {
        if (!r.ok) throw new Error(`galleries.json HTTP ${r.status}`);
        return r.json() as Promise<GalleriesData>;
      }),
      // Optional extras: if missing, the app still works without them.
      fetch("/data/gallery_essays.json")
        .then((r) => (r.ok ? (r.json() as Promise<GalleryEssaysData>) : {}))
        .catch(() => ({}) as GalleryEssaysData),
      fetch("/data/essay_periods.json")
        .then((r) => (r.ok ? (r.json() as Promise<EssaysData>) : null))
        .catch(() => null),
    ])
      .then(([galleriesData, essaysByGallery, essaysData]) => {
        for (const [gn, essayList] of Object.entries(essaysByGallery)) {
          const g = galleriesData.galleries[gn];
          if (g) g.essays = essayList;
        }
        setData(galleriesData);
        setEssays(essaysData);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Failed to load gallery data</h1>
        <p>{error}</p>
        <p>
          Make sure <code>web/public/data/galleries.json</code> exists. Run the
          data pipeline first.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, color: "#666" }}>Loading gallery data…</div>
    );
  }

  const selected =
    selectedGallery && data.galleries[selectedGallery]
      ? data.galleries[selectedGallery]
      : null;

  // Style helpers — pill segmented control (used for app view + list/map).
  const segBtn = (
    active: boolean,
    disabled: boolean = false
  ): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 500,
    border: "none",
    background: active ? PANEL_BG : "transparent",
    color: active ? TEXT_PRIMARY : disabled ? TEXT_MUTED : TEXT_SECONDARY,
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: RADIUS_CARD,
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.07)" : undefined,
    transition: "background 0.15s, color 0.15s",
  });
  const segGroup: React.CSSProperties = {
    display: "inline-flex",
    padding: 3,
    gap: 2,
    background: "rgba(0,0,0,0.045)",
    borderRadius: RADIUS_CARD,
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: APP_BG,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: isMobile ? "12px 16px 10px" : "18px 32px 14px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={
            isMobile
              ? {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 12,
                }
              : undefined
          }
        >
          <h1 style={{ margin: 0, lineHeight: 1.15 }}>
            <button
              onClick={() => {
                setRoute({
                  view: "galleries",
                  mode: "list",
                  galleryNumber: null,
                  essayId: null,
                });
                setPulseObjectId(null);
              }}
              title="Back to home"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 24,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                letterSpacing: -0.2,
                lineHeight: 1.15,
                cursor: "pointer",
                transition: "color 0.15s",
              }}
              onMouseEnter={(ev) => {
                ev.currentTarget.style.color = MET_RED;
              }}
              onMouseLeave={(ev) => {
                ev.currentTarget.style.color = TEXT_PRIMARY;
              }}
            >
              The Met Fifth Avenue
            </button>
          </h1>
          {isMobile && appView === "galleries" && viewMode === "list" && (
            <button
              onClick={() => setTocOpen(true)}
              aria-label="Open department list"
              title="Departments"
              style={{
                background: "none",
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS_CARD,
                minWidth: 40,
                minHeight: 36,
                padding: "7px 10px",
                cursor: "pointer",
                color: TEXT_SECONDARY,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Top-level view: Galleries vs Essays */}
        <div style={segGroup}>
          {(["galleries", "essays"] as const).map((v) => {
            const active = appView === v;
            const disabled = v === "essays" && !essays;
            return (
              <button
                key={v}
                onClick={() => {
                  if (disabled) return;
                  setRoute({ view: v });
                  setPulseObjectId(null);
                }}
                disabled={disabled}
                title={disabled ? "essay_periods.json not loaded" : undefined}
                style={{ ...segBtn(active, disabled), textTransform: "capitalize" }}
              >
                {v}
              </button>
            );
          })}
        </div>

        {appView === "galleries" && (
          <div style={segGroup}>
            {(["list", "map"] as const).map((v) => {
              const active = viewMode === v;
              return (
                <button
                  key={v}
                  onClick={() => setRoute({ mode: v })}
                  style={{
                    ...segBtn(active),
                    padding: "5px 12px",
                    fontSize: 12.5,
                    textTransform: "capitalize",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        )}

        <SearchBox
          galleries={data.galleries}
          isMobile={isMobile}
          onSelect={(galleryNumber, _floor, objectId) => {
            setRoute({ galleryNumber, essayId: null });
            setPulseObjectId(objectId ?? null);
          }}
        />
      </header>


      {/* Main content */}
      {appView === "essays" && essays ? (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 28px 28px",
          }}
        >
          <div
            style={{
              backgroundColor: PANEL_BG,
              borderRadius: RADIUS_PANEL,
              border: `1px solid ${BORDER}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: "24px 28px 28px",
              minHeight: "calc(100% - 16px)",
            }}
          >
            <EssaysView
              data={essays}
              selectedPeriod={null}
              essayToGalleries={essayToGalleries}
              onJumpToGallery={(gn) =>
                setRoute({ view: "galleries", galleryNumber: gn, essayId: null })
              }
            />
          </div>
        </div>
      ) : (
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Department TOC.
            • Desktop list mode: visible as a left rail.
            • Mobile: hidden by default; opens as a drawer from the hamburger
              button in the header.
            • Map mode (any size): hidden — spatial layout is the TOC. */}
        {viewMode === "list" && !isMobile && (
          <aside
            style={{
              flex: "0 0 200px",
              minWidth: 0,
              overflow: "auto",
              padding: "8px 0 28px 20px",
            }}
          >
            <DepartmentToc
              galleries={data.galleries}
              scrollRootRef={listScrollRef}
            />
          </aside>
        )}
        {isMobile && viewMode === "list" && (
          <MobileDrawer open={tocOpen} onClose={() => setTocOpen(false)}>
            <div style={{ padding: "14px 8px" }}>
              <DepartmentToc
                galleries={data.galleries}
                scrollRootRef={listScrollRef}
                onItemClick={() => setTocOpen(false)}
              />
            </div>
          </MobileDrawer>
        )}
        {/* Floor plan (main). In list mode we shrink to a fixed 520px when a
            gallery panel opens; in map mode we keep the map as half the page
            so spatial context stays legible while reading the panel.
            The white card itself is the scroll container (not this column),
            so its top edge stays pinned level with the right-hand card. */}
        <div
          style={{
            flex: selected
              ? viewMode === "map"
                ? "1 1 50%"
                : "0 0 520px"
              : "1",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "8px 28px 28px",
          }}
        >
          <div
            ref={listScrollRef}
            style={{
              backgroundColor: PANEL_BG,
              borderRadius: RADIUS_PANEL,
              border: `1px solid ${BORDER}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: "20px 24px 16px",
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            {viewMode === "list" ? (
              <FloorPlan
                galleries={data.galleries}
                selectedGallery={selectedGallery}
                onSelectGallery={(g) => {
                  setRoute({ galleryNumber: g, essayId: null });
                  setPulseObjectId(null);
                }}
              />
            ) : (
              <div>
                {/* Floor tabs (map view only) + link to the printed PDF */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                    marginBottom: 20,
                  }}
                >
                  <div style={segGroup}>
                    {MAP_FLOORS.map((mf) => {
                      const active = mapFloor === mf.key;
                      return (
                        <button
                          key={mf.key}
                          onClick={() => {
                            setRoute({
                              mapFloor: mf.key,
                              galleryNumber: null,
                              essayId: null,
                            });
                            setPulseObjectId(null);
                          }}
                          style={segBtn(active)}
                        >
                          {mf.label}
                        </button>
                      );
                    })}
                  </div>
                  <a
                    href="https://www.newyorkwelcome.net/ecms/met-fifth-avenue-map.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: MET_RED,
                      textDecoration: "none",
                      borderBottom: `1px dotted ${MET_RED}`,
                      paddingBottom: 1,
                    }}
                  >
                    Open PDF map ↗
                  </a>
                </div>
                <MapView
                  key={mapFloor}
                  galleries={data.galleries}
                  floor={
                    MAP_FLOORS.find((f) => f.key === mapFloor)?.renderFloors ?? [
                      mapFloor as FloorKey,
                    ]
                  }
                  floorLabel={
                    MAP_FLOORS.find((f) => f.key === mapFloor)?.label ?? ""
                  }
                  selectedGallery={selectedGallery}
                  pulseGalleryNumber={pulseGalleryOnMap}
                  onSelectGallery={(g) => {
                    setRoute({ galleryNumber: g, essayId: null });
                    setPulseObjectId(null);
                    setPulseGalleryOnMap(null);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Gallery panel.
            • Desktop: right column (520px in list mode, 50% in map mode).
            • Mobile: a bottom sheet rendered outside this row so it overlays. */}
        {selected && selectedGallery && !isMobile ? (
          <div
            style={{
              flex: viewMode === "map" ? "1 1 50%" : "1 1 auto",
              minWidth: 0,
              overflow: "hidden",
              padding: "8px 28px 28px 0",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor: PANEL_BG,
                borderRadius: RADIUS_PANEL,
                border: `1px solid ${BORDER}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <GalleryPanel
                galleryNumber={selectedGallery}
                gallery={selected}
                pulseObjectId={pulseObjectId}
                essayFilter={essayFilter}
                onSetEssayFilter={(filter) => {
                  setRoute({ essayId: filter ? filter.essayId : null });
                }}
                onShowOnMap={() => {
                  const f = selected.floor === 3 ? 2 : (selected.floor ?? 1);
                  const tab = f === 0 ? 1 : f;
                  setRoute({ mode: "map", mapFloor: tab });
                }}
                onClose={() => {
                  setRoute({ galleryNumber: null, essayId: null });
                  setPulseObjectId(null);
                }}
              />
            </div>
          </div>
        ) : !isMobile ? (
          <div
            style={{
              flex: "0 0 32%",
              minWidth: 0,
              overflow: "auto",
              padding: "8px 28px 28px 0",
            }}
          >
            <FeaturedGallery
              galleries={data.galleries}
              onOpenGallery={(gn) => {
                setRoute({ galleryNumber: gn, essayId: null });
                setPulseObjectId(null);
              }}
            />
          </div>
        ) : null}
      </div>
      )}

      {isMobile && (
        <MobileBottomSheet
          open={!!selected && !!selectedGallery}
          heightVh={0.97}
          onClose={() => {
            setRoute({ galleryNumber: null, essayId: null });
            setPulseObjectId(null);
          }}
        >
          {selected && selectedGallery && (
            <GalleryPanel
              galleryNumber={selectedGallery}
              gallery={selected}
              pulseObjectId={pulseObjectId}
              essayFilter={essayFilter}
              onSetEssayFilter={(filter) => {
                setRoute({ essayId: filter ? filter.essayId : null });
              }}
              onShowOnMap={() => {
                const f = selected.floor === 3 ? 2 : (selected.floor ?? 1);
                const tab = f === 0 ? 1 : f;
                // On mobile the sheet covers the screen, so closing it (by
                // clearing the gallery selection) is what reveals the map.
                // Remember which cell to pulse so the user can find it.
                setPulseGalleryOnMap(selectedGallery);
                setRoute({
                  mode: "map",
                  mapFloor: tab,
                  galleryNumber: null,
                  essayId: null,
                });
                setPulseObjectId(null);
              }}
              onClose={() => {
                setRoute({ galleryNumber: null, essayId: null });
                setPulseObjectId(null);
              }}
            />
          )}
        </MobileBottomSheet>
      )}

      <footer
        style={{
          flexShrink: 0,
          padding: "10px 28px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          fontSize: 11.5,
          color: TEXT_MUTED,
          flexWrap: "wrap",
          background: APP_BG,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>
            Sources
          </span>
          <FooterLink href="https://metmuseum.github.io/">
            Met Collection API
          </FooterLink>
          <FooterLink href="https://www.metmuseum.org/essays/timeline-of-art-history">
            Heilbrunn Timeline of Art History
          </FooterLink>
          <FooterLink href="https://www.metmuseum.org/visit/plan-your-visit/met-fifth-avenue">
            Living Map (Met Fifth Avenue)
          </FooterLink>
        </div>
        <div>
          Built by{" "}
          <a
            href="https://frsantos.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: MET_RED,
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Ryan Santos
          </a>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: TEXT_SECONDARY,
        textDecoration: "none",
        borderBottom: `1px dotted ${BORDER_STRONG}`,
        paddingBottom: 1,
      }}
    >
      {children}
    </a>
  );
}

export default App;
