"""Assign each Heilbrunn essay to one or more period buckets.

For each essay, we look up the date ranges of its related_works in met.db,
take the median midpoint of those dates, and assign to the bucket containing
it. We also tag the essay with any *additional* bucket that ≥30% of its dated
citations fall in (so a "Crusades 1095–1291" essay tags both Medieval and
Classical-adjacent only if it really straddles).

Only objects in our met.db have dates (those currently on view + a few in
storage we enriched). Essays whose cited objects are entirely off-view fall
through to "unassigned".

Output: web/public/data/essay_periods.json
    {
      "periods": [ ...same 8 buckets as gallery_periods.json... ],
      "by_essay": {
        "<essay_id>": {
          "primary": "ancient",
          "all": ["ancient", "classical"],
          "n_dated": 7,          # cited objects we had dates for
          "n_total": 12,         # total related_works
          "median_year": -1200
        },
        ...
      },
      "by_period": {
        "ancient": ["essay-1", "essay-2", ...],
        "unassigned": ["essay-x", ...]
      }
    }
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path

import duckdb
import polars as pl

ROOT = Path(__file__).resolve().parent.parent
HEILBRUNN_PARQUET = Path(
    "/Users/francisryansantos/heilbrunn-timeline/data/parsed/essays.parquet"
)
MET_DB = ROOT / "data" / "met.db"
OUT = ROOT / "web" / "public" / "data" / "essay_periods.json"

PERIODS = [
    {"id": "prehistoric",  "label": "Prehistoric",  "start": -50_000, "end": -3000},
    {"id": "ancient",      "label": "Ancient",      "start":  -3000,  "end":  -500},
    {"id": "classical",    "label": "Classical",    "start":   -500,  "end":   500},
    {"id": "medieval",     "label": "Medieval",     "start":    500,  "end":  1400},
    {"id": "early-modern", "label": "Early Modern", "start":   1400,  "end":  1700},
    {"id": "c18",          "label": "18th Century", "start":   1700,  "end":  1800},
    {"id": "c19",          "label": "19th Century", "start":   1800,  "end":  1900},
    {"id": "modern",       "label": "Modern",       "start":   1900,  "end":  2100},
]

# Cap on a single object's date range; same noise filter as gallery clusters.
MAX_RANGE = 1500
# An essay gets a secondary period if this share of its dated objects fall in
# the period's interval.
SECONDARY_THRESHOLD = 0.30


def period_for_year(year: float) -> str | None:
    for p in PERIODS:
        if p["start"] <= year < p["end"]:
            return p["id"]
    return None


def main() -> None:
    essays = pl.read_parquet(HEILBRUNN_PARQUET)
    print(f"essays: {essays.height}")

    # Pull object_id -> midpoint(year) from met.db
    con = duckdb.connect(str(MET_DB), read_only=True)
    obj_rows = con.sql(f"""
        SELECT object_id,
               object_begin_date,
               object_end_date,
               (object_begin_date + object_end_date) / 2.0 AS midpoint
        FROM objects_live
        WHERE object_begin_date IS NOT NULL AND object_end_date IS NOT NULL
          AND (object_end_date - object_begin_date) <= {MAX_RANGE}
    """).fetchall()
    obj_midpoint: dict[int, float] = {int(r[0]): float(r[3]) for r in obj_rows}
    print(f"objects with usable dates: {len(obj_midpoint)}")

    by_essay: dict[str, dict] = {}
    n_unassigned = 0
    for r in essays.iter_rows(named=True):
        works = r.get("related_works") or []
        n_total = len(works)
        author_names = [a["name"] for a in (r.get("authors") or []) if a.get("name")]
        # Strip "T00:00:00..." suffix from the ISO date for display
        pub = (r.get("published_date") or "")[:10] or None

        midpoints: list[float] = []
        for w in works:
            try:
                oid = int(w["object_id"])
            except (TypeError, ValueError, KeyError):
                continue
            mp = obj_midpoint.get(oid)
            if mp is not None:
                midpoints.append(mp)

        base = {
            "title": r["title"],
            "url": r["url"],
            "authors": author_names,
            "published": pub,
            "n_total": n_total,
        }
        if not midpoints:
            n_unassigned += 1
            by_essay[r["essay_id"]] = {
                **base,
                "primary": None,
                "all": [],
                "n_dated": 0,
                "median_year": None,
            }
            continue
        median_year = statistics.median(midpoints)
        primary = period_for_year(median_year)
        order = [p["id"] for p in PERIODS]
        in_period = {pid: 0 for pid in order}
        for mp in midpoints:
            pid = period_for_year(mp)
            if pid:
                in_period[pid] += 1
        threshold = max(1, int(len(midpoints) * SECONDARY_THRESHOLD))
        all_periods = [pid for pid in order if in_period[pid] >= threshold]
        if primary and primary not in all_periods:
            all_periods.insert(0, primary)
        by_essay[r["essay_id"]] = {
            **base,
            "primary": primary,
            "all": all_periods,
            "n_dated": len(midpoints),
            "median_year": round(median_year),
        }

    # Inverse: period -> [essay_ids]. Add "unassigned" as a pseudo-period for
    # essays with no dated citations.
    by_period: dict[str, list[str]] = {p["id"]: [] for p in PERIODS}
    by_period["unassigned"] = []
    for eid, info in by_essay.items():
        if not info["primary"]:
            by_period["unassigned"].append(eid)
        else:
            by_period[info["primary"]].append(eid)
    for pid in by_period:
        by_period[pid].sort()

    out = {
        "periods": PERIODS,
        "by_essay": by_essay,
        "by_period": by_period,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out))

    print(f"\nessays unassigned (no dated citations): {n_unassigned}")
    print(f"by primary period:")
    for p in PERIODS:
        print(f"  {p['id']:14s} {p['label']:14s} -> {len(by_period[p['id']])} essays")
    print(f"  unassigned     {'':14s} -> {len(by_period['unassigned'])} essays")
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
