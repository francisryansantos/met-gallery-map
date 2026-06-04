# Met Gallery Map

Interactive floor plan of the Metropolitan Museum of Art. Click a gallery to
see what's currently on view, with thumbnails and links to metmuseum.org.

**Scope:** All on-view objects across the museum — 44,609 objects across 413
galleries (Floors 0–3, all 17 departments). 545 of the original 45,335
on-view IDs failed to enrich (see `fetch_failures` table in `met.db`).

## Data pipeline

Requires Python 3.9+, `httpx`, `duckdb`.

```bash
pip install httpx duckdb

# Step 1: Gallery lookup from Living Map API (already done, in data/)
# Step 2: Download Met open access CSV (~300 MB)
curl -L -o data/MetObjects.csv \
  'https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv'

# Filter to objects with gallery numbers
python3 data/compose.py  # (if parquet already exists)

# Step 3: Enrich with live API data (~45k objects; resumable, several hours)
python3 data/enrich.py

# Step 4: Compose frontend JSON
python3 data/compose.py
```

## Frontend

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173.

## Data sources

- **Gallery metadata:** Living Map API (`map-api.prod.livingmap.com`)
- **Object metadata:** Met open access CSV + collection API
- See `data/00_map_recon.md` for full API recon notes

## Limitations

- 545 of ~45,000 on-view objects failed to enrich (API errors, see
  `fetch_failures` table); the remaining 44,609 are fully covered.
- Floor plan is a schematic grid, not a traced architectural plan.
- Gallery names come from the Living Map app and may not match the Met's
  internal naming exactly.
- "On view" status is a snapshot from when the enrichment script ran.
