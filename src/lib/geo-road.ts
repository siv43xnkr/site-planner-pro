export type LatLngPoint = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function toLocalMeters(point: LatLngPoint, origin: LatLngPoint) {
  const lat0 = toRad(origin.lat);
  const x = toRad(point.lng - origin.lng) * Math.cos(lat0) * EARTH_RADIUS_M;
  const y = toRad(point.lat - origin.lat) * EARTH_RADIUS_M;
  return { x, y };
}

function segmentProjection(
  point: LatLngPoint,
  start: LatLngPoint,
  end: LatLngPoint,
): { t: number; distance: number } {
  const p = toLocalMeters(point, point);
  const a = toLocalMeters(start, point);
  const b = toLocalMeters(end, point);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;

  if (ab2 === 0) {
    return { t: 0, distance: Math.hypot(a.x - p.x, a.y - p.y) };
  }

  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  const qx = a.x + t * abx;
  const qy = a.y + t * aby;
  return { t, distance: Math.hypot(p.x - qx, p.y - qy) };
}

export function nearestPolygonEdgeIndex(points: LatLngPoint[], click: LatLngPoint): number {
  if (points.length < 2) return -1;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const start = points[i]!;
    const end = points[(i + 1) % points.length]!;
    const { distance } = segmentProjection(click, start, end);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function pointProjectionFractionOnSegment(
  point: LatLngPoint,
  start: LatLngPoint,
  end: LatLngPoint,
): number {
  return segmentProjection(point, start, end).t;
}
