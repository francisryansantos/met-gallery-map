"""Compute cross-departmental period clusters of galleries.

For each gallery, find which broad art-historical period buckets its on-view
objects span. A gallery belongs to a bucket if at least MIN_HITS objects fall
inside (so a single outlier doesn't pull a Roman gallery into "Modern").

Output: web/public/data/gallery_periods.json
    {
      "periods": [
        {"id": "ancient", "label": "Ancient", "start": -3000, "end": -500},
        ...
      ],
      "by_gallery": { "<gallery_number>": ["classical", "medieval"], ... },
      "by_period":  { "ancient": ["<gallery_number>", ...], ... }
    }
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
MET_DB = ROOT / "data" / "met.db"
OUT = ROOT / "web" / "public" / "data" / "gallery_periods.json"

# Period buckets are inclusive of `start`, exclusive of `end`. Periods don't
# have to be exhaustive — an object outside every period (e.g. a 25,000 BCE
# stone tool) just won't contribute to any bucket.
PERIODS = [
    {"id": "prehistoric", "label": "Prehistoric",   "start": -50_000, "end": -3000},
    {"id": "ancient",     "label": "Ancient",       "start":  -3000,  "end":  -500},
    {"id": "classical",   "label": "Classical",     "start":   -500,  "end":   500},
    {"id": "medieval",    "label": "Medieval",      "start":    500,  "end":  1400},
    {"id": "early-modern","label": "Early Modern",  "start":   1400,  "end":  1700},
    {"id": "c18",         "label": "18th Century",  "start":   1700,  "end":  1800},
    {"id": "c19",         "label": "19th Century",  "start":   1800,  "end":  1900},
    {"id": "modern",      "label": "Modern",        "start":   1900,  "end":  2100},
]

# A gallery is tagged with a period only if at least this many of its on-view
# objects overlap the bucket. Filters out outliers (one Roman coin in a
# Modern gallery shouldn't make it "Classical").
MIN_HITS = 3


def main() -> None:
    con = duckdb.connect(str(MET_DB), read_only=True)

    # Per-gallery period counts via interval overlap. An object's [begin, end]
    # overlaps a period [pstart, pend) iff end >= pstart AND begin < pend.
    rows = con.sql("""
        SELECT gallery_number, object_begin_date, object_end_date
        FROM objects_live
        WHERE gallery_number IS NOT NULL AND gallery_number <> ''
          AND object_begin_date IS NOT NULL
          AND object_end_date   IS NOT NULL
          -- Drop objects whose date range is wider than 1500 years; they're
          -- usually undated cultural attributions ("Pre-Columbian") that would
          -- otherwise dump into every bucket.
          AND (object_end_date - object_begin_date) <= 1500
    """).fetchall()

    by_gallery: dict[str, dict[str, int]] = {}
    for gn, b, e in rows:
        gn = gn.strip()
        counts = by_gallery.setdefault(gn, {})
        for p in PERIODS:
            if e >= p["start"] and b < p["end"]:
                counts[p["id"]] = counts.get(p["id"], 0) + 1

    # Apply threshold; keep only buckets with >= MIN_HITS objects
    gallery_to_periods: dict[str, list[str]] = {}
    for gn, counts in by_gallery.items():
        kept = [pid for pid, n in counts.items() if n >= MIN_HITS]
        if kept:
            # Preserve canonical period order
            order = [p["id"] for p in PERIODS]
            kept.sort(key=order.index)
            gallery_to_periods[gn] = kept

    # Invert
    period_to_galleries: dict[str, list[str]] = {p["id"]: [] for p in PERIODS}
    for gn, pids in gallery_to_periods.items():
        for pid in pids:
            period_to_galleries[pid].append(gn)
    for pid in period_to_galleries:
        period_to_galleries[pid].sort()

    out = {
        "periods": PERIODS,
        "by_gallery": gallery_to_periods,
        "by_period": period_to_galleries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))

    print(f"galleries with at least one period tag: {len(gallery_to_periods)}")
    print(f"period coverage:")
    for p in PERIODS:
        print(f"  {p['id']:14s} {p['label']:14s} -> {len(period_to_galleries[p['id']])} galleries")
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
