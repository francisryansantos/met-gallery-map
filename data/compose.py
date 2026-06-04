"""Step 4: Compose the frontend data file from SQLite + gallery CSV."""

import csv
import json
import sqlite3


def main():
    db = sqlite3.connect("data/met.db")
    db.row_factory = sqlite3.Row

    def to_float(v):
        try:
            return float(v) if v not in (None, "") else None
        except ValueError:
            return None

    # Load gallery lookup from Living Map data. We exclude The Met Cloisters —
    # this app is for Fifth Avenue only. Cloisters galleries are identified by
    # department ("The Cloisters" / "Medieval Art and The Cloisters") or by
    # latitude (~40.86, north of Manhattan).
    def is_cloisters(dept, lat, gn=None):
        if dept and "Cloister" in dept:
            return True
        if lat is not None and lat > 40.85:
            return True
        # Fifth Avenue galleries are numbered 100+; anything 1-50 is Cloisters
        # numbering (some are tagged "Medieval Art" in the object data but
        # they're physically at the Cloisters site).
        if gn:
            try:
                n = int(gn)
                if 1 <= n <= 50:
                    return True
            except ValueError:
                pass
        return False

    gallery_meta = {}
    skipped_cloisters = 0
    with open("data/galleries.csv") as fh:
        for row in csv.DictReader(fh):
            gn = row["gallery_number"]
            dept = row.get("department") or None
            lat = to_float(row.get("latitude"))
            if is_cloisters(dept, lat, gn):
                skipped_cloisters += 1
                continue
            # Normalize: strip leading zeros for matching
            gn_norm = gn.lstrip("0") or "0"
            gallery_meta[gn_norm] = {
                "name": row.get("gallery_name") or f"Gallery {gn}",
                "department": dept,
                "floor": parse_floor(row.get("floor", "")),
                "wing": row.get("wing") or None,
                "lat": lat,
                "lon": to_float(row.get("longitude")),
            }
    print(f"Skipped {skipped_cloisters} Cloisters galleries")

    # Load enriched objects with gallery numbers
    rows = db.execute("""
        SELECT object_id, gallery_number, title, object_name, department,
               culture, period, classification,
               primary_image_small, object_url, raw_json
        FROM objects_live
        WHERE gallery_number IS NOT NULL AND gallery_number != ''
    """).fetchall()

    print(f"Objects with gallery numbers: {len(rows):,}")

    # Group objects by gallery
    galleries = {}
    skipped_cloisters_objs = 0
    for row in rows:
        gn = row["gallery_number"].strip()
        if not gn:
            continue
        # Skip Cloisters objects regardless of which dept got assigned to the
        # gallery elsewhere. This filters Cloisters-dept objects AND objects
        # in Cloisters-numbered galleries (1-50, which are Medieval-Art-tagged
        # but physically at the Cloisters).
        if is_cloisters(row["department"], None, gn):
            skipped_cloisters_objs += 1
            continue

        if gn not in galleries:
            meta = gallery_meta.get(gn, {})
            galleries[gn] = {
                "name": meta.get("name", f"Gallery {gn}"),
                "department": row["department"] or meta.get("department"),
                "floor": meta.get("floor"),
                "wing": meta.get("wing"),
                "lat": meta.get("lat"),
                "lon": meta.get("lon"),
                "object_count": 0,
                "objects": [],
            }

        # Pull artist info out of the cached Met API response.
        artist = None
        artist_bio = None
        if row["raw_json"]:
            try:
                meta = json.loads(row["raw_json"])
                prefix = (meta.get("artistPrefix") or "").strip()
                name = (meta.get("artistDisplayName") or "").strip()
                suffix = (meta.get("artistSuffix") or "").strip()
                if name:
                    artist = " ".join(p for p in (prefix, name, suffix) if p)
                bio = (meta.get("artistDisplayBio") or "").strip()
                artist_bio = bio or None
            except (ValueError, TypeError):
                pass

        obj = {
            "id": row["object_id"],
            "title": row["title"] or "Untitled",
            "object_name": row["object_name"],
            "artist": artist,
            "artist_bio": artist_bio,
            "culture": row["culture"] or None,
            "period": row["period"] or None,
            "classification": row["classification"] or None,
            "image": row["primary_image_small"] or None,
            "url": row["object_url"]
                or f"https://www.metmuseum.org/art/collection/search/{row['object_id']}",
        }
        galleries[gn]["objects"].append(obj)

    # Sort objects within each gallery: images first, then by object ID
    for gn, gallery in galleries.items():
        gallery["objects"].sort(
            key=lambda o: (0 if o["image"] else 1, o["id"])
        )
        gallery["object_count"] = len(gallery["objects"])

    # Add empty placeholders for galleries known to Living Map but with no
    # on-view objects in our enriched data. They render as grayed-out rooms
    # on the floor plan map so the spatial layout matches the printed PDF.
    # The list / TOC views filter these out separately so the curatorial
    # department list isn't cluttered with donor-named empty sub-spaces.
    for gn, meta in gallery_meta.items():
        if gn in galleries:
            continue
        if meta.get("lat") is None or meta.get("lon") is None:
            continue
        galleries[gn] = {
            "name": meta.get("name", f"Gallery {gn}"),
            "department": meta.get("department"),
            "floor": meta.get("floor"),
            "wing": meta.get("wing"),
            "lat": meta.get("lat"),
            "lon": meta.get("lon"),
            "object_count": 0,
            "objects": [],
        }

    # If department not set from API, try to infer from objects
    for gn, gallery in galleries.items():
        if not gallery["department"]:
            # Use the most common department from objects
            depts = {}
            for obj_row in db.execute(
                "SELECT department FROM objects_live WHERE gallery_number = ?",
                (gn,),
            ).fetchall():
                d = obj_row["department"]
                if d:
                    depts[d] = depts.get(d, 0) + 1
            if depts:
                gallery["department"] = max(depts, key=depts.get)

    output = {"galleries": galleries}

    out_path = "web/public/data/galleries.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    # Stats
    total_objects = sum(g["object_count"] for g in galleries.values())
    floor2 = {k: v for k, v in galleries.items() if v.get("floor") == 2}
    floor2_objects = sum(g["object_count"] for g in floor2.values())

    print(f"\nWrote {out_path}")
    print(f"  Total galleries: {len(galleries)}")
    print(f"  Total objects: {total_objects:,}")
    print(f"  Floor 2 galleries: {len(floor2)}")
    print(f"  Floor 2 objects: {floor2_objects:,}")

    # Show top 10 floor 2 galleries by object count
    print("\n  Top 10 floor 2 galleries:")
    for gn, g in sorted(floor2.items(), key=lambda x: -x[1]["object_count"])[:10]:
        print(f"    Gallery {gn:>5s}: {g['object_count']:4d} objects  {g['name']}")

    db.close()


def parse_floor(s: str):
    mapping = {"G": 0, "1": 1, "1M": 1, "2": 2, "3": 3, "4": 4, "5": 5}
    return mapping.get(s)


if __name__ == "__main__":
    main()
