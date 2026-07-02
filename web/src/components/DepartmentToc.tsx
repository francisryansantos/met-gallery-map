import { useMemo, type RefObject } from "react";
import type { Gallery } from "../types";
import { curatorialCompare } from "../departments";
import { useActiveSection } from "../hooks/useActiveSection";
import {
  HOVER_BG,
  MET_RED,
  RADIUS_CARD,
  TEXT_SECONDARY,
} from "../theme";
import { deptSlug } from "./FloorPlan";

interface DepartmentTocProps {
  galleries: Record<string, Gallery>;
  /** Scroll container watched for which dept section is currently visible. */
  scrollRootRef: RefObject<HTMLElement | null>;
  /** Called after a TOC entry is clicked + scrolled — lets the host close a
   * drawer on mobile. No-op when undefined. */
  onItemClick?: () => void;
}

interface Entry {
  department: string;
  count: number;
}

const UNASSIGNED = "Other / Unassigned";

export default function DepartmentToc({
  galleries,
  scrollRootRef,
  onItemClick,
}: DepartmentTocProps) {
  const entries = useMemo<Entry[]>(() => {
    const counts = new Map<string, number>();
    for (const [, g] of Object.entries(galleries)) {
      if (g.lat != null && g.lat > 40.85) continue;
      // Only count galleries that have on-view objects; map shows placeholders
      // separately so the TOC stays focused on real curatorial departments.
      if (g.object_count === 0) continue;
      const dept = g.department || UNASSIGNED;
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => curatorialCompare(a.department, b.department));
  }, [galleries]);

  // State lives here, not in App, so scroll-tick re-renders don't ripple into
  // the (much heavier) FloorPlan.
  const activeDeptId = useActiveSection(
    scrollRootRef,
    'section[id^="dept-"]',
    entries.length
  );

  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Departments"
      style={{
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        padding: "20px 12px 20px 4px",
      }}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {entries.map(({ department }) => {
          const slug = deptSlug(department);
          const isActive = activeDeptId === slug;
          return (
            <li key={department}>
              <a
                href={`#${slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(slug);
                  if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
                  onItemClick?.();
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "5px 10px",
                  borderRadius: RADIUS_CARD,
                  fontSize: 12.5,
                  color: isActive ? MET_RED : TEXT_SECONDARY,
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? HOVER_BG : "transparent",
                  textDecoration: "none",
                  lineHeight: 1.3,
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(ev) => {
                  if (!isActive) {
                    ev.currentTarget.style.background = HOVER_BG;
                    ev.currentTarget.style.color = MET_RED;
                  }
                }}
                onMouseLeave={(ev) => {
                  if (!isActive) {
                    ev.currentTarget.style.background = "transparent";
                    ev.currentTarget.style.color = TEXT_SECONDARY;
                  }
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{department}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Export so FloorPlan/App can also use the helper if needed
export { deptSlug };
