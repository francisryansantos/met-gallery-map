"""Join Heilbrunn essays ↔ on-view objects ↔ galleries, emit gallery_essays.json.

Output schema:
  {
    "<gallery_number>": [
      {
        "essay_id":   "akwanshi-stone-monoliths",
        "title":      "The Akwanshi Stone Monoliths...",
        "url":        "https://www.metmuseum.org/essays/akwanshi-stone-monoliths",
        "object_ids": [317729, 312522],          # which objects in *this* gallery the essay cites
        "n_total":    4                          # total related_works the essay has
      },
      ...
    ],
    ...
  }

Sorted within each gallery by `len(object_ids)` desc — essays that cite more of
this gallery's objects come first.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import duckdb
import polars as pl

ROOT = Path(__file__).resolve().parent.parent
ESSAYS_PARQUET = Path("/Users/francisryansantos/heilbrunn-timeline/data/parsed/essays.parquet")
MET_DB = ROOT / "data" / "met.db"
OUT = ROOT / "web" / "public" / "data" / "gallery_essays.json"


def main() -> None:
    essays = pl.read_parquet(ESSAYS_PARQUET)
    # essay_id, title, url, related_works (list of struct)
    df = (
        essays.select(["essay_id", "title", "url", "related_works"])
        .rename({"title": "essay_title", "url": "essay_url"})
        .with_columns(
            pl.col("related_works").list.len().alias("n_total"),
        )
        .explode("related_works")
        .with_columns(pl.col("related_works").struct.field("object_id").alias("object_id"))
        .drop("related_works")
        .drop_nulls("object_id")
        .with_columns(pl.col("object_id").cast(pl.Int64))
    )

    con = duckdb.connect(str(MET_DB), read_only=True)
    con.register("essay_obj", df)
    joined = con.sql("""
        SELECT eo.essay_id, eo.essay_title, eo.essay_url, eo.n_total,
               eo.object_id, ol.gallery_number
        FROM essay_obj eo JOIN objects_live ol USING (object_id)
        WHERE ol.gallery_number IS NOT NULL AND ol.gallery_number <> ''
    """).pl()

    out: dict[str, list[dict]] = defaultdict(list)
    # Group: (gallery_number, essay_id) -> {essay_title, essay_url, n_total, object_ids[]}
    by_gallery_essay: dict[tuple[str, str], dict] = {}
    for row in joined.iter_rows(named=True):
        key = (row["gallery_number"], row["essay_id"])
        entry = by_gallery_essay.get(key)
        if entry is None:
            entry = {
                "essay_id": row["essay_id"],
                "title": row["essay_title"],
                "url": row["essay_url"],
                "object_ids": [],
                "n_total": row["n_total"],
            }
            by_gallery_essay[key] = entry
        entry["object_ids"].append(int(row["object_id"]))

    for (gallery_number, _), entry in by_gallery_essay.items():
        # dedupe + sort object_ids
        entry["object_ids"] = sorted(set(entry["object_ids"]))
        out[gallery_number].append(entry)

    # Sort each gallery's essays: most-cited-in-this-gallery first, then alphabetically
    for gn in out:
        out[gn].sort(key=lambda e: (-len(e["object_ids"]), e["title"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    total_pairs = sum(len(v) for v in out.values())
    print(f"galleries with essays:   {len(out):>4d} / 413")
    print(f"total (gallery, essay):  {total_pairs:>4d}")
    print(f"unique essays linked:    {len({e['essay_id'] for v in out.values() for e in v})}")
    print(f"wrote: {OUT}")


if __name__ == "__main__":
    main()
