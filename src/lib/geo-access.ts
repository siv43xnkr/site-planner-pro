/// <reference types="google.maps" />

import { pointProjectionFractionOnSegment } from "@/lib/geo-road";

export type LatLngPoint = { lat: number; lng: number };

export const BADA_DOST_BODY_WIDTH_M = 1.842;
export const ACCESS_CORRIDOR_WIDTH_M = 3.0;
export const ABSOLUTE_GATE_MIN_M = 2.3;
export const PREFERRED_GATE_MIN_M = 3.0;
export const ROAD_SCREEN_PASS_M = 4.5;

/**
 * Returns the nearest point on a polygon boundary to a geographic point.
 * This is used to connect the mapped gate to the nearest face of the B zone.
 */
export function nearestPointOnPolygonBoundary(
  maps: typeof google.maps,
  point: google.maps.LatLng,
  polygon: google.maps.LatLng[],
): google.maps.LatLng | null {
  if (polygon.length < 2) return null;

  let best: google.maps.LatLng | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const fraction = pointProjectionFractionOnSegment(
      { lat: point.lat(), lng: point.lng() },
      { lat: a.lat(), lng: a.lng() },
      { lat: b.lat(), lng: b.lng() },
    );
    const candidate = maps.geometry.spherical.interpolate(a, b, fraction);
    const distance = maps.geometry.spherical.computeDistanceBetween(point, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

/** Builds a real-metre rectangular access corridor around the direct gate-to-B centreline. */
export function buildCorridorPath(
  maps: typeof google.maps,
  start: google.maps.LatLng,
  end: google.maps.LatLng,
  widthMeters: number,
): google.maps.LatLng[] {
  const heading = maps.geometry.spherical.computeHeading(start, end);
  const half = widthMeters / 2;
  const startLeft = maps.geometry.spherical.computeOffset(start, half, heading - 90);
  const startRight = maps.geometry.spherical.computeOffset(start, half, heading + 90);
  const endRight = maps.geometry.spherical.computeOffset(end, half, heading + 90);
  const endLeft = maps.geometry.spherical.computeOffset(end, half, heading - 90);
  return [startLeft, startRight, endRight, endLeft];
}

type XY = { x: number; y: number };
const EARTH_RADIUS_M = 6371008.8;
const EPSILON = 1e-7;

function project(point: LatLngPoint, origin: LatLngPoint): XY {
  const lat0 = (origin.lat * Math.PI) / 180;
  const dLat = ((point.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((point.lng - origin.lng) * Math.PI) / 180;
  return {
    x: EARTH_RADIUS_M * dLng * Math.cos(lat0),
    y: EARTH_RADIUS_M * dLat,
  };
}

function orientation(a: XY, b: XY, c: XY): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function properSegmentsIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < -EPSILON && o3 * o4 < -EPSILON;
}

function pointInPolygonStrict(point: XY, polygon: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** True only when two polygons have a real interior overlap; boundary touching alone is allowed. */
export function polygonsOverlap(a: LatLngPoint[], b: LatLngPoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const all = [...a, ...b];
  const origin = all.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat / all.length, lng: acc.lng + point.lng / all.length }),
    { lat: 0, lng: 0 },
  );
  const ax = a.map((point) => project(point, origin));
  const bx = b.map((point) => project(point, origin));

  for (let i = 0; i < ax.length; i += 1) {
    const a0 = ax[i]!;
    const a1 = ax[(i + 1) % ax.length]!;
    for (let j = 0; j < bx.length; j += 1) {
      const b0 = bx[j]!;
      const b1 = bx[(j + 1) % bx.length]!;
      if (properSegmentsIntersect(a0, a1, b0, b1)) return true;
    }
  }

  return pointInPolygonStrict(ax[0]!, bx) || pointInPolygonStrict(bx[0]!, ax);
}
