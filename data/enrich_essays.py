"""Attach `gallery_number` and `on_view` to each related_works entry in the
Heilbrunn essay records. Reads essays.parquet from the heilbrunn project and
met.db here, writes enriched outputs back to heilbrunn-timeline/data/parsed/.

Schema change (only inside related_works structs):
    {object_id, title, url}
becomes
    {object_id, title, url, gallery_number, on_view}

where gallery_number is None if the object isn't currently on view (still in
the Met collection but in storage or off-view).
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import duckdb
import polars as pl

HEILBRUNN = Path("/Users/francisryansantos/heilbrunn-timeline/data/parsed")
ESSAYS_IN = HEILBRUNN / "essays.parquet"
MET_DB = Path(__file__).resolve().parent / "met.db"
OUT_DIR = HEILBRUNN
JSONL_OUT = OUT_DIR / "essays_with_galleries.jsonl"
PARQUET_OUT = OUT_DIR / "essays_with_galleries.parquet"
CSV_OUT = OUT_DIR / "essays_with_galleries.csv"

NESTED_FOR_CSV = {
    "authors", "regions", "periods", "keywords",
    "references", "related_works", "related_essays", "related_chronologies",
}


def main() -> None:
    essays = pl.read_parquet(ESSAYS_IN)
    print(f"essays: {essays.height}")

    # Build object_id -> {gallery_number, on_view} lookup from met.db
    con = duckdb.connect(str(MET_DB), read_only=True)
    obj_rows = con.sql("""
        SELECT object_id, gallery_number
        FROM objects_live
        WHERE object_id IS NOT NULL
    """).fetchall()
    obj_to_gallery: dict[int, str | None] = {
        int(oid): (gn.strip() if gn else None) for oid, gn in obj_rows
    }
    print(f"on-view objects in met.db: {len(obj_to_gallery)}")

    # Walk essays, augment each related_works entry
    rows = essays.to_dicts()
    n_works = n_on_view = 0
    for r in rows:
        works = r.get("related_works") or []
        new_works = []
        for w in works:
            n_works += 1
            try:
                oid = int(w["object_id"])
            except (TypeError, ValueError, KeyError):
                oid = None
            gn = obj_to_gallery.get(oid) if oid is not None else None
            new_works.append({
                **w,
                "gallery_number": gn,
                "on_view": gn is not None,
            })
            if gn:
                n_on_view += 1
        r["related_works"] = new_works

    print(f"related_works total: {n_works}")
    print(f"  on view (have gallery): {n_on_view} ({n_on_view / max(n_works,1):.0%})")

    # Write JSONL
    with JSONL_OUT.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, default=str, ensure_ascii=False) + "\n")
    print(f"wrote {JSONL_OUT}")

    # Parquet — let polars infer struct schema from the augmented rows
    df = pl.from_dicts(rows)
    df.write_parquet(PARQUET_OUT)
    print(f"wrote {PARQUET_OUT}")

    # CSV — same flattening rules as the heilbrunn CLI: department split into
    # per-slot columns, other nested fields JSON-encoded.
    max_dept = max((len(r.get("department") or []) for r in rows), default=0)
    dept_cols = [f"department_{i + 1}" for i in range(max_dept)]
    flat_rows = []
    for r in rows:
        flat = {}
        for k, v in r.items():
            if k == "department":
                depts = (v or []) + [None] * (max_dept - len(v or []))
                for col, val in zip(dept_cols, depts):
                    flat[col] = val
            elif k in NESTED_FOR_CSV:
                flat[k] = json.dumps(v, default=str, ensure_ascii=False)
            else:
                flat[k] = v
        flat_rows.append(flat)
    schema_overrides = {c: pl.Utf8 for c in dept_cols}
    csv_df = pl.from_dicts(flat_rows, schema_overrides=schema_overrides)
    csv_df.write_csv(CSV_OUT)
    print(f"wrote {CSV_OUT}")


if __name__ == "__main__":
    main()
