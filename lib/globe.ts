import { geoDistance } from "d3-geo";

/** The orthographic globe looks at the opposite of its d3 rotation. */
export function projectionCenter(rotate: [number, number]): [number, number] {
  return [-rotate[0], -rotate[1]];
}

/** True when a place is on the near hemisphere, not seen through the globe. */
export function isFacing(lng: number, lat: number, centerLng: number, centerLat: number): boolean {
  return geoDistance([lng, lat], [centerLng, centerLat]) < Math.PI / 2;
}

/** A landmass is worth drawing when its center is facing, with a little extra reach for large countries. */
export function isOnScreen(lng: number, lat: number, span: number, centerLng: number, centerLat: number): boolean {
  const reach = Math.PI / 2 + Math.min(Math.max(span, 0), 0.9) * 0.5;
  return geoDistance([lng, lat], [centerLng, centerLat]) < reach;
}

/** Zoomed in, skip countries that sit outside the canvas even if they are on the near side of the globe. */
export function isInView(
  lng: number,
  lat: number,
  span: number,
  centerLng: number,
  centerLat: number,
  radiusPx: number,
  halfDiagonalPx: number,
): boolean {
  if (!isOnScreen(lng, lat, span, centerLng, centerLat)) return false;
  const theta = geoDistance([lng, lat], [centerLng, centerLat]);
  const pad = Math.min(Math.max(span, 0), 0.6) * radiusPx;
  return Math.sin(Math.min(theta, Math.PI / 2)) * radiusPx <= halfDiagonalPx + pad + 32;
}

export function fadeRange(value: number, start: number, end: number): number {
  if (value <= start) return 0;
  if (value >= end) return 1;
  return (value - start) / (end - start);
}

type Ring = number[][];

export type CountryPiece = {
  geometry: { type: "Polygon"; coordinates: number[][][] };
  lng: number;
  lat: number;
  /** Larger side of this landmass, in radians. */
  span: number;
  europe: boolean;
};

type CountryGeometry = {
  type: string;
  coordinates: number[][][] | number[][][][];
};

/** Western and central Europe, including the crowded smaller countries. */
export function isEuropeanLand(lng: number, lat: number, span: number): boolean {
  return lng >= -25 && lng <= 40 && lat >= 34 && lat <= 72 && span < 0.6;
}

function ringExtent(ring: Ring): { lng: number; lat: number; span: number; area: number } | null {
  if (ring.length < 4) return null;
  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (maxLng - minLng > 180) return null;
  const lat = (minLat + maxLat) / 2;
  const width = (maxLng - minLng) * Math.cos((lat * Math.PI) / 180);
  const height = maxLat - minLat;
  return {
    lng: (minLng + maxLng) / 2,
    lat,
    span: Math.max(width, height) * (Math.PI / 180),
    area: Math.max(width, 0) * Math.max(height, 0),
  };
}

/** Split each country into landmasses so a small European country is not tied to a distant territory. */
export function countryPieces(features: { geometry: CountryGeometry }[]): CountryPiece[] {
  const pieces: CountryPiece[] = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    const polygons = geometry?.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry?.type === "MultiPolygon" ? (geometry.coordinates as number[][][][]) : [];
    for (const polygon of polygons) {
      const extent = ringExtent(polygon[0]);
      if (!extent) continue;
      pieces.push({
        geometry: { type: "Polygon", coordinates: polygon },
        lng: extent.lng,
        lat: extent.lat,
        span: extent.span,
        europe: isEuropeanLand(extent.lng, extent.lat, extent.span),
      });
    }
  }
  return pieces;
}

/**
 * Landmass that belongs to a label. A large neighbor does not override a smaller
 * country, and a nearby islet does not override the mainland.
 */
export function largestNearbySpan(origin: { lng: number; lat: number }, pieces: { lng: number; lat: number; span: number }[], maxDegrees = 4): number | null {
  let bestScore = 0;
  let bestSpan: number | null = null;
  const max = maxDegrees * maxDegrees;
  for (const piece of pieces) {
    const distance2 = (piece.lng - origin.lng) ** 2 + (piece.lat - origin.lat) ** 2;
    if (distance2 > max) continue;
    const score = piece.span / (Math.sqrt(distance2) + 0.45);
    if (score <= bestScore) continue;
    bestScore = score;
    bestSpan = piece.span;
  }
  return bestSpan;
}

/**
 * European borders wait until that country is large on the globe.
 * `radiusPx` is the orthographic scale: min(width, height) * 0.42 * zoom.
 */
export function europeBorderAlpha(span: number, radiusPx: number): number {
  return fadeRange(span * radiusPx, 92, 128);
}

/** Names come in later than borders and stay once they are readable. */
export function europeLabelAlpha(span: number, radiusPx: number): number {
  return fadeRange(span * radiusPx, 108, 160);
}
