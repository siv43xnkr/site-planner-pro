export type LatLngPoint = { lat: number; lng: number };

type XY = { x: number; y: number };

const EARTH_RADIUS_M = 6371008.8;
const BOUNDARY_TOLERANCE_M = 0.03;

function projectPoint(point: LatLngPoint, origin: LatLngPoint): XY {
  const lat0 = (origin.lat * Math.PI) / 180;
  const dLat = ((point.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((point.lng - origin.lng) * Math.PI) / 180;
  return {
    x: EARTH_RADIUS_M * dLng * Math.cos(lat0),
    y: EARTH_RADIUS_M * dLat,
  };
}

function pointToSegmentDistance(point: XY, a: XY, b: XY): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denom = abx * abx + aby * aby;
  if (denom === 0) return Math.hypot(apx, apy);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function pointInPolygonInclusive(point: XY, polygon: XY[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    if (pointToSegmentDistance(point, a, b) <= BOUNDARY_TOLERANCE_M) return true;
  }

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

function orientation(a: XY, b: XY, c: XY): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function properSegmentsIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * Returns true when the complete inner polygon is inside (or on) the container polygon.
 * Intended for small site-planning geometries where a local metre projection is accurate.
 */
export function polygonContainsPolygon(
  container: LatLngPoint[],
  inner: LatLngPoint[],
): boolean {
  if (container.length < 3 || inner.length < 3) return false;

  const origin = container.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat / container.length, lng: acc.lng + point.lng / container.length }),
    { lat: 0, lng: 0 },
  );

  const outerXY = container.map((point) => projectPoint(point, origin));
  const innerXY = inner.map((point) => projectPoint(point, origin));

  // Every template corner must be inside or exactly on the parcel boundary.
  if (innerXY.some((point) => !pointInPolygonInclusive(point, outerXY))) return false;

  // A concave parcel can contain all template corners while one template edge exits the parcel.
  // Reject any true boundary crossing.
  for (let i = 0; i < innerXY.length; i += 1) {
    const a = innerXY[i]!;
    const b = innerXY[(i + 1) % innerXY.length]!;

    for (let j = 0; j < outerXY.length; j += 1) {
      const c = outerXY[j]!;
      const d = outerXY[(j + 1) % outerXY.length]!;
      if (properSegmentsIntersect(a, b, c, d)) return false;
    }

    // Extra samples protect against degenerate cases where an edge passes through a parcel vertex.
    for (let step = 1; step < 10; step += 1) {
      const t = step / 10;
      const sample = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!pointInPolygonInclusive(sample, outerXY)) return false;
    }
  }

  return true;
}
