// Tiny hash-based router. The URL is the source of truth for the
// shareable bits of app state. Transient stuff (search input, pulse target)
// stays in React state.
//
// URL scheme:
//   #/galleries                                  — list view (default)
//   #/galleries?gallery=162                      — gallery 162 panel open
//   #/galleries?gallery=162&essay=julio-claudian — gallery panel with essay filter active
//   #/galleries/map                              — map view, floor 1
//   #/galleries/map?floor=2                      — map view, floor 2
//   #/galleries/map?floor=2&gallery=162          — map + gallery open
//   #/essays                                     — essays view
import { useCallback, useEffect, useState } from "react";

export type AppView = "galleries" | "essays";
export type ViewMode = "list" | "map";

export interface RouteState {
  view: AppView;
  mode: ViewMode;       // only meaningful when view === "galleries"
  mapFloor: number;     // only meaningful when mode === "map"
  galleryNumber: string | null;
  essayId: string | null;
}

const DEFAULT: RouteState = {
  view: "galleries",
  mode: "list",
  mapFloor: 1,
  galleryNumber: null,
  essayId: null,
};

export function parseHash(hash: string): RouteState {
  const trimmed = hash.replace(/^#\/?/, "");
  const [path, queryStr = ""] = trimmed.split("?");
  const params = new URLSearchParams(queryStr);

  let view: AppView = "galleries";
  let mode: ViewMode = "list";

  if (path === "essays") {
    view = "essays";
  } else if (path === "galleries/map" || path === "map") {
    mode = "map";
  }

  const floorParam = parseInt(params.get("floor") ?? "");
  const mapFloor = floorParam === 2 ? 2 : 1;

  return {
    view,
    mode,
    mapFloor,
    galleryNumber: params.get("gallery") || null,
    essayId: params.get("essay") || null,
  };
}

export function buildHash(state: RouteState): string {
  let path: string;
  if (state.view === "essays") {
    path = "essays";
  } else if (state.mode === "map") {
    path = "galleries/map";
  } else {
    path = "galleries";
  }

  const params = new URLSearchParams();
  // Only encode non-defaults to keep URLs tidy.
  if (state.view === "galleries" && state.mode === "map" && state.mapFloor !== 1) {
    params.set("floor", String(state.mapFloor));
  }
  if (state.galleryNumber) params.set("gallery", state.galleryNumber);
  if (state.essayId) params.set("essay", state.essayId);

  const q = params.toString();
  return `#/${path}${q ? "?" + q : ""}`;
}

/**
 * Source-of-truth hook. Returns the current parsed route + an updater that
 * accepts a partial state. The updater pushes a new URL (via location.hash)
 * which fires hashchange and round-trips back into state — so browser back /
 * forward Just Works.
 */
export function useRoute(): [RouteState, (patch: Partial<RouteState>) => void] {
  const [state, setState] = useState<RouteState>(() =>
    parseHash(window.location.hash || "#/")
  );

  useEffect(() => {
    const onHashChange = () => setState(parseHash(window.location.hash || "#/"));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const update = useCallback((patch: Partial<RouteState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // Apply default normalization: clearing a gallery clears the essay too,
      // since essay-filter is meaningful only within a gallery.
      if (patch.galleryNumber === null && prev.essayId) next.essayId = null;
      // Switching to essays view clears any gallery selection.
      if (patch.view === "essays") {
        next.galleryNumber = null;
        next.essayId = null;
      }
      const newHash = buildHash(next);
      if (newHash !== window.location.hash) {
        window.location.hash = newHash;
      }
      return next;
    });
  }, []);

  return [state, update];
}

export const DEFAULT_ROUTE = DEFAULT;
