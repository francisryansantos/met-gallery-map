export interface MetObject {
  id: number;
  title: string;
  object_name: string | null;
  artist: string | null;
  artist_bio: string | null;
  culture: string | null;
  period: string | null;
  classification: string | null;
  image: string | null;
  url: string;
}

export interface EssayLink {
  essay_id: string;
  title: string;
  url: string;
  object_ids: number[];   // which objects in THIS gallery the essay cites
  n_total: number;        // total related_works the essay has
}

export interface Gallery {
  name: string;
  department: string | null;
  floor: number | null;
  wing: string | null;
  lat: number | null;
  lon: number | null;
  object_count: number;
  objects: MetObject[];
  essays?: EssayLink[];   // optional; only populated if gallery_essays.json had matches
}

export interface GalleriesData {
  galleries: Record<string, Gallery>;
}

export type GalleryEssaysData = Record<string, EssayLink[]>;

export interface PeriodCluster {
  id: string;
  label: string;
  start: number;  // year, negative for BCE
  end: number;
}

export interface PeriodsData {
  periods: PeriodCluster[];
  by_gallery: Record<string, string[]>;   // gallery_number -> period ids
  by_period: Record<string, string[]>;    // period id -> gallery_numbers
}

export interface EssayPeriodEntry {
  title: string;
  url: string;
  authors: string[];
  published: string | null;       // ISO yyyy-mm-dd
  n_total: number;                 // total related_works
  n_dated: number;                 // related_works with a usable date
  primary: string | null;          // period id, null if no dated citations
  all: string[];                   // primary + secondaries (>=30% threshold)
  median_year: number | null;
}

export interface EssaysData {
  periods: PeriodCluster[];
  by_essay: Record<string, EssayPeriodEntry>;
  by_period: Record<string, string[]>;     // includes "unassigned" key
}
