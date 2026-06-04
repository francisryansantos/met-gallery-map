# Met Museum Map Recon — Living Map API

## Summary

The Met's map at `maps.metmuseum.org` is a **Living Map** application built on
Mapbox GL JS. It loads gallery data from a public REST API at
`map-api.prod.livingmap.com`. No authentication is required.

## Key Endpoints

### Map config
```
GET https://map-api.prod.livingmap.com/v1/maps?host=maps.metmuseum.org
```
Returns project metadata (project ID = `the_met`), Mapbox access token, floor
definitions, center coordinates, extents, and attribution.

### Floors
The Met has 7 floor levels:

| id | floor | short_name | label    |
|----|-------|------------|----------|
| 1  | 0.0   | G          | Floor G  |
| 2  | 1.0   | 1          | Floor 1  |
| 3  | 1.5   | 1M         | Floor 1M |
| 4  | 2.0   | 2          | Floor 2  |
| 5  | 3.0   | 3          | Floor 3  |
| 6  | 4.0   | 4          | Floor 4  |
| 7  | 5.0   | 5          | Floor 5  |

### Features (galleries, POIs, amenities)
```
GET https://map-api.prod.livingmap.com/v1/maps/the_met/features?floor={floor_id}&limit=500
```
Returns up to 500 features per request. Each feature has:
- `id` — unique hash
- `label.name` — gallery number (e.g., "207")
- `categories.subcategory.id` — "gallery", "art", "amenity", etc.
- `location.center` — lat/lng centroid
- `location.floor` — which floor it lives on
- `information.long_name` — gallery display name (e.g., "Tang and Liao Dynasties")
- `information.description` — paragraph description; first line often names the wing
- `information.summary` — short label like "Gallery 207"
- `is_temporarily_closed` — boolean
- `media.popup.url` — thumbnail image URL (Sanity CDN)

**Note:** The `floor` query param doesn't actually filter — all 458 galleries are
returned regardless of floor param. Filtering must be done client-side using
`location.floor.short_name`.

### Feature by ID
```
GET https://map-api.prod.livingmap.com/v1/maps/the_met/features/{feature_id}
```

### Search
```
GET https://map-api.prod.livingmap.com/v1/maps/the_met/search?query={term}
```

## What We Got

- **458 unique galleries** across all floors
- **207 galleries on Floor 2** (our target floor)
- **214 galleries on Floor 1**
- Each has: gallery number, display name, lat/lng, floor, and usually a wing
  name extractable from the description's first line
- Saved to `data/galleries.csv` and `data/livingmap_galleries_raw.json`

## What's Missing

- **Department** is NOT directly provided. The description's first line sometimes
  names the wing (e.g., "Florence and Herbert Irving Asian Wing") but not the
  Met's internal department taxonomy. We can map department from the Met's
  collection API once we match objects to galleries.
- **Gallery polygons** are not in the features API — the map renders them as
  Mapbox vector tiles. The tile style is loaded via the Mapbox access token.
  Extracting actual polygon geometries would require parsing the vector tiles,
  which is possible but non-trivial.
- The `wing` field can be partially inferred from the description but isn't
  standardized.

## Met Collection API Notes

The Met's public API at `collectionapi.metmuseum.org` provides:
- `GET /public/collection/v1/objects/{id}` — full object metadata including
  `GalleryNumber` (but NO `isOnView` or `galleryName` field)
- `GET /public/collection/v1/search?isOnView=true&q=*` — returns object IDs
  for items currently on view (45,335 objects as of 2026-05-14)
- `GET /public/collection/v1/departments` — 19 departments with IDs

**Key finding:** The API does NOT have an `isOnView` field on individual objects.
To determine what's on view, we must use the search endpoint with `isOnView=true`
and cross-reference. The `GalleryNumber` field on individual objects tells us
where it is (if on view).

## Recommended Approach for Steps 2-4

1. Download the Met open access CSV (MetObjects.csv, ~470k rows) — filter to
   rows with a non-null Gallery Number
2. Use the search API with `isOnView=true` to get the set of on-view object IDs
3. For each on-view object, hit the individual object API to get
   `primaryImageSmall` and `GalleryNumber`
4. Join with our gallery lookup from Living Map to get gallery names
5. Department comes from the object's `department` field in the API
