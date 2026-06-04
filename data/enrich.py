"""Enrich on-view Met objects with live API data. Resumable via SQLite."""

import asyncio
import json
import sqlite3
import time
from datetime import datetime, timezone

import httpx

API_BASE = "https://collectionapi.metmuseum.org/public/collection/v1/objects"
DB_PATH = "data/met.db"
DELAY = 0.12  # seconds between requests (~8/s target)


def get_remaining_ids(db: sqlite3.Connection) -> list[int]:
    with open("data/on_view_ids.json") as f:
        all_ids = set(json.load(f))

    already = set(
        r[0] for r in db.execute("SELECT object_id FROM objects_live").fetchall()
    )
    failed = set(
        r[0] for r in db.execute("SELECT object_id FROM fetch_failures").fetchall()
    )

    remaining = [oid for oid in all_ids if oid not in already and oid not in failed]

    print(f"  Total on-view: {len(all_ids):,}")
    print(f"  Already fetched: {len(already):,}")
    print(f"  Failed (skipping): {len(failed):,}")
    print(f"  Will fetch: {len(remaining):,}")
    return remaining


def parse_object(data: dict) -> dict:
    return {
        "object_id": data.get("objectID"),
        "gallery_number": data.get("GalleryNumber", "").strip() or None,
        "title": data.get("title"),
        "object_name": data.get("objectName"),
        "department": data.get("department"),
        "culture": data.get("culture"),
        "period": data.get("period"),
        "medium": data.get("medium"),
        "classification": data.get("classification"),
        "object_date": data.get("objectDate"),
        "object_begin_date": data.get("objectBeginDate"),
        "object_end_date": data.get("objectEndDate"),
        "primary_image_small": data.get("primaryImageSmall", "").strip() or None,
        "object_url": data.get("objectURL"),
        "is_public_domain": 1 if data.get("isPublicDomain") else 0,
        "is_highlight": 1 if data.get("isHighlight") else 0,
        "credit_line": data.get("creditLine"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "raw_json": json.dumps(data),
    }


async def main():
    db = sqlite3.connect(DB_PATH)
    remaining = get_remaining_ids(db)
    total = len(remaining)

    if total == 0:
        print("Nothing to fetch!")
        db.close()
        return

    fetched = 0
    ok_count = 0
    fail_count = 0
    start = time.time()
    commit_interval = 50

    async with httpx.AsyncClient() as client:
        for i, oid in enumerate(remaining):
            try:
                resp = await client.get(f"{API_BASE}/{oid}", timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    parsed = parse_object(data)
                    db.execute(
                        """INSERT OR REPLACE INTO objects_live VALUES
                        (:object_id, :gallery_number, :title, :object_name,
                         :department, :culture, :period, :medium, :classification,
                         :object_date, :object_begin_date, :object_end_date,
                         :primary_image_small, :object_url, :is_public_domain,
                         :is_highlight, :credit_line, :fetched_at, :raw_json)""",
                        parsed,
                    )
                    ok_count += 1
                elif resp.status_code == 403:
                    # Rate limited — back off
                    await asyncio.sleep(10)
                    # Retry once
                    resp = await client.get(f"{API_BASE}/{oid}", timeout=15)
                    if resp.status_code == 200:
                        data = resp.json()
                        parsed = parse_object(data)
                        db.execute(
                            """INSERT OR REPLACE INTO objects_live VALUES
                            (:object_id, :gallery_number, :title, :object_name,
                             :department, :culture, :period, :medium, :classification,
                             :object_date, :object_begin_date, :object_end_date,
                             :primary_image_small, :object_url, :is_public_domain,
                             :is_highlight, :credit_line, :fetched_at, :raw_json)""",
                            parsed,
                        )
                        ok_count += 1
                    else:
                        db.execute(
                            "INSERT OR REPLACE INTO fetch_failures VALUES (?, ?, ?)",
                            (oid, f"HTTP {resp.status_code}", datetime.now(timezone.utc).isoformat()),
                        )
                        fail_count += 1
                else:
                    db.execute(
                        "INSERT OR REPLACE INTO fetch_failures VALUES (?, ?, ?)",
                        (oid, f"HTTP {resp.status_code}", datetime.now(timezone.utc).isoformat()),
                    )
                    fail_count += 1
            except Exception as e:
                db.execute(
                    "INSERT OR REPLACE INTO fetch_failures VALUES (?, ?, ?)",
                    (oid, str(e)[:200], datetime.now(timezone.utc).isoformat()),
                )
                fail_count += 1

            fetched += 1
            if fetched % commit_interval == 0:
                db.commit()
                elapsed = time.time() - start
                rate = fetched / elapsed
                eta = (total - fetched) / rate
                print(
                    f"  {fetched:,}/{total:,} ({fetched*100//total}%) "
                    f"| {rate:.1f}/s | ETA {eta/60:.1f}m "
                    f"| {ok_count} ok, {fail_count} fail",
                    flush=True,
                )

            await asyncio.sleep(DELAY)

    db.commit()
    final_count = db.execute("SELECT COUNT(*) FROM objects_live").fetchone()[0]
    final_fail = db.execute("SELECT COUNT(*) FROM fetch_failures").fetchone()[0]
    with_gallery = db.execute(
        "SELECT COUNT(*) FROM objects_live WHERE gallery_number IS NOT NULL"
    ).fetchone()[0]
    elapsed = time.time() - start
    print(f"\nDone in {elapsed/60:.1f} minutes!")
    print(f"  {final_count:,} objects fetched, {final_fail:,} failures")
    print(f"  Objects with gallery number: {with_gallery:,}")
    db.close()


if __name__ == "__main__":
    asyncio.run(main())
