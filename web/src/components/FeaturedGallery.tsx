import { useMemo, useState } from "react";
import type { Gallery } from "../types";
import {
  BORDER,
  FONT_DISPLAY,
  MET_RED,
  PANEL_BG,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../theme";

interface FeaturedGalleryProps {
  galleries: Record<string, Gallery>;
  onOpenGallery: (galleryNumber: string) => void;
}

// Fills the right column when no gallery is open. Instead of an empty
// "click a gallery" placeholder, show a random gallery with a preview grid
// of its objects — every visit starts with art on screen.
export default function FeaturedGallery({
  galleries,
  onOpenGallery,
}: FeaturedGalleryProps) {
  const candidates = useMemo(
    () =>
      Object.entries(galleries).filter(
        ([, g]) => g.objects.filter((o) => o.image).length >= 6
      ),
    [galleries]
  );
  const [seed, setSeed] = useState(() => Math.random());

  if (candidates.length === 0) return null;
  const [galleryNumber, gallery] =
    candidates[Math.floor(seed * candidates.length)];
  const preview = gallery.objects.filter((o) => o.image).slice(0, 6);

  return (
    <div
      style={{
        backgroundColor: PANEL_BG,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        padding: "22px 24px 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: MET_RED,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        From the collection · Gallery {galleryNumber}
      </div>
      <h2
        style={{
          margin: "6px 0 0",
          fontFamily: FONT_DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          letterSpacing: -0.2,
          lineHeight: 1.2,
        }}
      >
        {gallery.name}
      </h2>
      <div
        style={{
          marginTop: 6,
          fontSize: 12.5,
          color: TEXT_SECONDARY,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {gallery.department && (
          <span style={{ fontWeight: 600 }}>{gallery.department}</span>
        )}
        <span style={{ color: TEXT_MUTED }}>
          {gallery.object_count} objects on view
        </span>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
      >
        {preview.map((o) => (
          <button
            key={o.id}
            onClick={() => onOpenGallery(galleryNumber)}
            title={o.title}
            style={{
              padding: 0,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
              background: "none",
              aspectRatio: "1",
              display: "block",
            }}
          >
            <img
              src={o.image!}
              alt={o.title}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <button
          onClick={() => onOpenGallery(galleryNumber)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: MET_RED,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Open gallery →
        </button>
        <button
          onClick={() => setSeed(Math.random())}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: TEXT_MUTED,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          ↻ Show another
        </button>
      </div>
    </div>
  );
}
