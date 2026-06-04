import { useEffect, useState, type RefObject } from "react";

/**
 * Watches a scroll container for which department section is most visible
 * and returns its id. Uses IntersectionObserver; root is the scroll
 * container so it works for nested scrollers, not just the document.
 *
 * The "most visible" section = the entry with the largest intersection ratio
 * among those currently intersecting; ties resolve toward the topmost.
 */
export function useActiveSection(
  scrollRootRef: RefObject<HTMLElement | null>,
  /** CSS selector for the elements to track inside the scroll container. */
  sectionSelector: string,
  /** Dep value: re-attach the observer when this changes (e.g. when the
   * section list rerenders after a data load). */
  resetKey: unknown
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    // Pin attention to the top quarter of the scroll viewport so the active
    // entry feels like "what I'm reading now" rather than "what's barely
    // peeking from below." rootMargin trims the bottom 70% of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        // Keep all currently-intersecting entries in a sorted list and pick
        // the topmost (smallest boundingClientRect.top relative to viewport).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id || null);
        }
      },
      {
        root,
        rootMargin: "0px 0px -70% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const els = root.querySelectorAll(sectionSelector);
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // resetKey forces re-attachment when sections change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRootRef, sectionSelector, resetKey]);

  return activeId;
}
