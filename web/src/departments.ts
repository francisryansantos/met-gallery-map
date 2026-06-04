// The Met's published curatorial department order, captured live from the
// /essays?toah=true filter dropdown. We use this as the canonical sort so
// the TOC, the FloorPlan section list, and any future dept-based UI all
// agree on order.
//
// Quirk: this is *mostly* alphabetical with leading "The" ignored, but the
// Met's own ordering has small idiosyncrasies (e.g. "Costume Institute
// Conservation" follows "The Costume Institute" by full-name sort). We
// preserve their order exactly rather than re-deriving alphabetically.

const CURATORIAL_ORDER: string[] = [
  "African Art in The Michael C. Rockefeller Wing",
  "The American Wing",
  "Ancient American Art in The Michael C. Rockefeller Wing",
  "Ancient West Asian Art",
  "Arms and Armor",
  "Asian Art",
  "The Costume Institute",
  "Costume Institute Conservation",
  "Digital",
  "Drawings and Prints",
  "East Asian Painting Conservation",
  "Education",
  "Egyptian Art",
  "European Paintings",
  "European Sculpture and Decorative Arts",
  "Greek and Roman Art",
  "Islamic Art",
  "Leonard A. Lauder Research Center for Modern Art",
  "Medieval Art and The Cloisters",
  "The Michael C. Rockefeller Wing",
  "Modern and Contemporary Art",
  "Musical Instruments",
  "Objects Conservation",
  "Oceanic Art in The Michael C. Rockefeller Wing",
  "Paintings Conservation",
  "Paper Conservation",
  "Photograph Conservation",
  "Photographs",
  "Provenance Research at The Met",
  "The Robert Lehman Collection",
  "Scientific Research",
  "Textile Conservation",
  "Thomas J. Watson Library",
  "Time-Based Media Conservation",
];

// Normalize a department name for fuzzy matching against CURATORIAL_ORDER.
// Drops "the ", lowercases, and trims. Used when the data's dept string
// differs slightly from the canonical name (e.g. "Medieval Art" in the
// object metadata vs "Medieval Art and The Cloisters" in the filter).
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ORDER_KEYS = CURATORIAL_ORDER.map(normalize);

/**
 * Return the curatorial-order index for a department name, or `Infinity`
 * if no canonical match exists. Matching is forgiving: exact normalized
 * match first, then "data dept is a prefix of canonical" (e.g. "Medieval
 * Art" matches "Medieval Art and The Cloisters"), then the reverse.
 */
export function curatorialIndex(department: string | null | undefined): number {
  if (!department) return Number.POSITIVE_INFINITY;
  const target = normalize(department);

  // 1. Exact normalized match
  const exact = ORDER_KEYS.indexOf(target);
  if (exact >= 0) return exact;

  // 2. Canonical starts with data dept (data is a shorter form)
  for (let i = 0; i < ORDER_KEYS.length; i++) {
    if (ORDER_KEYS[i].startsWith(target + " ")) return i;
  }

  // 3. Data dept starts with canonical (data is a longer / qualified form)
  for (let i = 0; i < ORDER_KEYS.length; i++) {
    if (target.startsWith(ORDER_KEYS[i] + " ")) return i;
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Comparator suitable for `Array.sort`. Orders by Met curatorial position
 * first, then alphabetically (ignoring leading "The") as a tiebreak for
 * any departments missing from the canonical list — those land at the end.
 */
export function curatorialCompare(a: string, b: string): number {
  const ai = curatorialIndex(a);
  const bi = curatorialIndex(b);
  if (ai !== bi) return ai - bi;
  return normalize(a).localeCompare(normalize(b));
}
