"""Extract structural elements from the Met Fifth Avenue PDF map.

Outputs web/public/data/pdf_positions.json with:
  - page  : PDF page dimensions
  - positions : gallery_number -> { x, y, w, h, floor }
  - labels    : list of { text, x, y, size }   (red wing/department labels)
  - walls     : list of { x1, y1, x2, y2 }     (architectural line segments)

The React app uses these to draw a stripped-down version of the printed map
with clickable gallery rooms.
"""

import json
import re
from pathlib import Path

import pdfplumber

RED = (0.0, 1.0, 0.75, 0.0)  # CMYK red used for wing/department labels
WALL_COLOR = (0.68, 0.35, 0.17, 0.4)  # brownish stroke used for room outlines
WING_LABEL_MIN_SIZE = 10  # exclude smaller red callouts


def near(a, b, tol):
    return abs(a - b) < tol


def merge_multiline_labels(labels):
    """Combine red-text words that sit directly above/below each other into a
    single multi-line label (e.g. 'Modern and' + 'Contemporary Art')."""
    by_size = {}
    for lab in labels:
        by_size.setdefault(round(lab["size"], 1), []).append(lab)

    merged = []
    for size, group in by_size.items():
        # Sort by y then x
        group.sort(key=lambda l: (l["y"], l["x"]))
        used = [False] * len(group)
        for i, lab in enumerate(group):
            if used[i]:
                continue
            cluster = [lab]
            used[i] = True
            for j in range(i + 1, len(group)):
                if used[j]:
                    continue
                other = group[j]
                # Same column (x overlap) + within ~1.5× line height
                dy = other["y"] - cluster[-1]["y"]
                if dy < 0:
                    continue
                if dy > size * 2.0:
                    break  # since sorted by y
                if abs(other["x"] - cluster[0]["x"]) < 40 or abs(
                    other["x"] - cluster[-1]["x"]
                ) < 40:
                    cluster.append(other)
                    used[j] = True
            text = " ".join(c["text"] for c in cluster)
            xs = [c["x"] for c in cluster]
            ys = [c["y"] for c in cluster]
            merged.append(
                {
                    "text": text,
                    "x": round(sum(xs) / len(xs), 2),
                    "y": round(sum(ys) / len(ys), 2),
                    "size": size,
                }
            )
    return merged


def extract_red_labels(page):
    """Pull red-text wing labels and merge multi-line spans."""
    words = page.extract_words(
        x_tolerance=2,
        y_tolerance=1,
        extra_attrs=["non_stroking_color", "size"],
    )
    raw = []
    for w in words:
        color = w.get("non_stroking_color")
        if color is None:
            continue
        if tuple(color) != RED:
            continue
        size = w.get("size") or 0
        if size < WING_LABEL_MIN_SIZE:
            continue
        raw.append(
            {
                "text": w["text"],
                "x": (w["x0"] + w["x1"]) / 2,
                "y": (w["top"] + w["bottom"]) / 2,
                "size": size,
            }
        )
    return merge_multiline_labels(raw)


def extract_walls(page):
    """Pull architectural line segments. Filter to the brown stroke color
    used for room outlines and require a minimum segment length."""
    walls = []
    for ln in page.lines:
        sc = ln.get("stroking_color")
        if sc is None or tuple(sc) != WALL_COLOR:
            continue
        x0, x1, y0, y1 = ln["x0"], ln["x1"], ln["top"], ln["bottom"]
        length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        # Skip short segments — these are mostly stair ticks, door swings,
        # and other small chrome that clutter the map.
        if length < 15:
            continue
        walls.append(
            {
                "x1": round(x0, 2),
                "y1": round(y0, 2),
                "x2": round(x1, 2),
                "y2": round(y1, 2),
            }
        )
    return walls


def main():
    pdf_path = Path("data/met-fifth-avenue-map.pdf")
    out_path = Path("web/public/data/pdf_positions.json")
    galleries_json = Path("web/public/data/galleries.json")

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        page_w, page_h = float(page.width), float(page.height)

        # 1) Gallery numbers (3-digit only) with their on-page coords.
        words = page.extract_words(x_tolerance=1.2, y_tolerance=1.0)
        raw_galls = []
        for w in words:
            if re.fullmatch(r"\d{3}", w["text"]):
                raw_galls.append(
                    {
                        "num": w["text"],
                        "x": round((w["x0"] + w["x1"]) / 2, 2),
                        "y": round((w["top"] + w["bottom"]) / 2, 2),
                        "w": round(w["x1"] - w["x0"], 2),
                        "h": round(w["bottom"] - w["top"], 2),
                    }
                )

        # 2) Wing/department labels (large red text), merged across lines.
        labels = extract_red_labels(page)

        # 3) Architectural walls — line segments forming room outlines.
        walls = extract_walls(page)

    # First-occurrence wins for any duplicate number (legend repeats etc.).
    seen = {}
    for g in sorted(raw_galls, key=lambda r: (r["y"], r["x"])):
        seen.setdefault(g["num"], g)

    data = json.loads(galleries_json.read_text())
    galleries = data["galleries"]
    positions = {}
    unmatched = []
    for num, g in seen.items():
        if num in galleries:
            positions[num] = {**g, "floor": galleries[num].get("floor")}
        else:
            unmatched.append(num)

    # Tag each label with the floor whose galleries it's closest to in Y.
    # The PDF has three vertically-stacked floor sections; using each label's
    # y to find the nearest gallery gives a clean per-floor split.
    placed_galls = list(positions.values())
    for lab in labels:
        if not placed_galls:
            lab["floor"] = None
            continue
        # Find the gallery with the smallest |y - label.y|
        nearest = min(placed_galls, key=lambda p: abs(p["y"] - lab["y"]))
        lab["floor"] = nearest.get("floor")

    # Tag each wall with the floor of the nearest gallery position. This
    # handles overlapping floor sections (e.g. Floor 3 insets above Floor 2)
    # that a simple y-range bucket can't resolve.
    floored_galls = [p for p in placed_galls if p.get("floor") is not None]
    page_h_local = 1400  # exclude the building elevation / legend at the bottom
    filtered_walls = []
    for w in walls:
        wx = (w["x1"] + w["x2"]) / 2
        wy = (w["y1"] + w["y2"]) / 2
        if wy > page_h_local:
            continue
        if not floored_galls:
            continue
        nearest = min(
            floored_galls,
            key=lambda p: (p["x"] - wx) ** 2 + (p["y"] - wy) ** 2,
        )
        # Drop walls that are too far from any gallery (decorative chrome).
        d2 = (nearest["x"] - wx) ** 2 + (nearest["y"] - wy) ** 2
        if d2 > 80 * 80:
            continue
        w["floor"] = nearest["floor"]
        filtered_walls.append(w)
    walls = filtered_walls

    out = {
        "page": {"width": page_w, "height": page_h},
        "positions": positions,
        "labels": labels,
        "walls": walls,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out))

    from collections import Counter

    print(f"Wrote {out_path}")
    print(f"  Page: {page_w:.0f} x {page_h:.0f} pt")
    print(f"  Gallery positions: {len(positions)} (unmatched: {len(unmatched)})")
    print(f"  Red wing labels:   {len(labels)}")
    print(f"  Wall segments:     {len(walls)}")
    print(f"  Labels by floor:   {dict(Counter(l.get('floor') for l in labels))}")
    print(f"  Walls by floor:    {dict(Counter(w.get('floor') for w in walls))}")


if __name__ == "__main__":
    main()
