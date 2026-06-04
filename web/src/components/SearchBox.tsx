import { useState, useMemo, useRef, useEffect } from "react";
import type { Gallery } from "../types";
import { MET_RED, type FloorKey } from "../theme";

interface SearchBoxProps {
  galleries: Record<string, Gallery>;
  /** When true, the input fills the available row width instead of being a
   * fixed 340px pinned to the right. */
  isMobile?: boolean;
  onSelect: (
    galleryNumber: string,
    floor: FloorKey,
    objectId?: number
  ) => void;
}

type ResultKind = "gallery" | "object" | "department";

interface Result {
  kind: ResultKind;
  galleryNumber: string;
  floor: FloorKey;
  label: string;
  sublabel: string;
  objectId?: number;
}

function floorToKey(floor: number | null): FloorKey {
  if (floor === 0 || floor === 1 || floor === 2 || floor === 3) return floor;
  return "other";
}

const MAX_GALLERIES = 6;
const MAX_DEPARTMENTS = 3;
const MAX_OBJECTS = 12;

export default function SearchBox({ galleries, isMobile, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const entries = useMemo(
    () =>
      Object.entries(galleries).filter(
        ([, g]) => !(g.lat != null && g.lat > 40.85) // Fifth Avenue only
      ),
    [galleries]
  );

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Result[] = [];
    const seenDepts = new Set<string>();
    let galleryCount = 0;
    let deptCount = 0;
    let objectCount = 0;

    // 1) Department matches — pick one representative gallery to land on.
    for (const [num, g] of entries) {
      if (deptCount >= MAX_DEPARTMENTS) break;
      const dept = g.department;
      if (!dept || seenDepts.has(dept)) continue;
      if (dept.toLowerCase().includes(q)) {
        seenDepts.add(dept);
        out.push({
          kind: "department",
          galleryNumber: num,
          floor: floorToKey(g.floor),
          label: dept,
          sublabel: "Department",
        });
        deptCount++;
      }
    }

    // 2) Gallery matches by number or name.
    for (const [num, g] of entries) {
      if (galleryCount >= MAX_GALLERIES) break;
      const hay = `${num} ${g.name.toLowerCase()}`;
      if (hay.includes(q)) {
        out.push({
          kind: "gallery",
          galleryNumber: num,
          floor: floorToKey(g.floor),
          label: `Gallery ${num} — ${g.name}`,
          sublabel: g.department || "Unknown department",
        });
        galleryCount++;
      }
    }

    // 3) Object matches — title, artist, culture, period, object type.
    for (const [num, g] of entries) {
      if (objectCount >= MAX_OBJECTS) break;
      for (const obj of g.objects) {
        if (objectCount >= MAX_OBJECTS) break;
        const title = obj.title.toLowerCase();
        const artist = (obj.artist || "").toLowerCase();
        const artistBio = (obj.artist_bio || "").toLowerCase();
        const culture = (obj.culture || "").toLowerCase();
        const period = (obj.period || "").toLowerCase();
        const objectName = (obj.object_name || "").toLowerCase();
        if (
          title.includes(q) ||
          artist.includes(q) ||
          artistBio.includes(q) ||
          culture.includes(q) ||
          period.includes(q) ||
          objectName.includes(q)
        ) {
          // Prefer artist in the sublabel when present — it's the most
          // distinguishing detail for paintings/sculpture/drawings.
          const subParts: string[] = [];
          if (obj.artist) subParts.push(obj.artist);
          subParts.push(`Gallery ${num} · ${g.name}`);
          out.push({
            kind: "object",
            galleryNumber: num,
            floor: floorToKey(g.floor),
            label: obj.title,
            sublabel: subParts.join(" — "),
            objectId: obj.id,
          });
          objectCount++;
        }
      }
    }

    return out;
  }, [entries, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const showDropdown = open && query.trim().length >= 2;

  function pick(r: Result) {
    onSelect(r.galleryNumber, r.floor, r.objectId);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || results.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        flex: isMobile ? "1 1 100%" : "0 0 340px",
        marginLeft: isMobile ? undefined : "auto",
        order: isMobile ? 10 : undefined,
        minWidth: 0,
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search galleries, objects, departments…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "7px 12px",
          fontSize: 13,
          fontFamily: "inherit",
          border: "1px solid #b8b890",
          borderRadius: 4,
          background: "rgba(255,255,255,0.7)",
          outline: "none",
          color: "#222",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = MET_RED;
          e.currentTarget.style.background = "#fff";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "#b8b890";
          e.currentTarget.style.background = "rgba(255,255,255,0.7)";
        }}
      />
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #c8c6a8",
            borderRadius: 4,
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            maxHeight: 440,
            overflowY: "auto",
            zIndex: 20,
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                fontSize: 12,
                color: "#888",
              }}
            >
              No matches
            </div>
          ) : (
            results.map((r, i) => {
              const active = i === activeIdx;
              return (
                <button
                  key={`${r.kind}-${r.galleryNumber}-${i}`}
                  onClick={() => pick(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 12px",
                    background: active ? "#f7f5ec" : "none",
                    border: "none",
                    borderBottom:
                      i < results.length - 1 ? "1px solid #f0eee0" : "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: MET_RED,
                      minWidth: 60,
                    }}
                  >
                    {r.kind === "object"
                      ? "Object"
                      : r.kind === "gallery"
                        ? "Gallery"
                        : "Section"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "#222",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "#888",
                        marginTop: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.sublabel}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
