/// <reference types="google.maps" />

import { polygonContainsPolygon } from "@/lib/geo-fit";
import {
  buildTemplateDefinition,
  localToLatLng,
  rectPath,
  type TemplateDefinition,
} from "@/lib/sns-template";
import type { TemplateSelection } from "@/lib/site-types";

export type LatLngPoint = { lat: number; lng: number };

export type AutoPlacement = {
  definition: TemplateDefinition;
  center: LatLngPoint;
  rotation: number;
  flipped: boolean;
  clearanceScore: number;
};

export type MaxConfigurationResult = {
  placement: AutoPlacement | null;
  testedCodes: string[];
};

type XY = { x: number; y: number };

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function centroid(points: LatLngPoint[]): LatLngPoint {
  if (points.length === 0) return { lat: 0, lng: 0 };
  return points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat / points.length,
      lng: acc.lng + point.lng / points.length,
    }),
    { lat: 0, lng: 0 },
  );
}

function toXY(point: LatLngPoint, origin: LatLngPoint): XY {
  const lat0 = toRad(origin.lat);
  return {
    x: EARTH_RADIUS_M * toRad(point.lng - origin.lng) * Math.cos(lat0),
    y: EARTH_RADIUS_M * toRad(point.lat - origin.lat),
  };
}

function pointSegmentDistance(point: XY, a: XY, b: XY): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denom = abx * abx + aby * aby;
  if (denom === 0) return Math.hypot(apx, apy);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  return Math.hypot(point.x - (a.x + t * abx), point.y - (a.y + t * aby));
}

function minCornerClearance(parcel: LatLngPoint[], corners: LatLngPoint[]): number {
  if (parcel.length < 3 || corners.length < 1) return 0;
  const origin = centroid(parcel);
  const outer = parcel.map((point) => toXY(point, origin));
  const inner = corners.map((point) => toXY(point, origin));
  let best = Number.POSITIVE_INFINITY;
  inner.forEach((point) => {
    for (let i = 0; i < outer.length; i += 1) {
      const a = outer[i]!;
      const b = outer[(i + 1) % outer.length]!;
      best = Math.min(best, pointSegmentDistance(point, a, b));
    }
  });
  return Number.isFinite(best) ? best : 0;
}

function candidateAngles(maps: typeof google.maps, parcel: LatLngPoint[], angleStep: number): number[] {
  const values = new Set<number>();
  for (let angle = 0; angle < 180; angle += angleStep) values.add(angle);

  for (let i = 0; i < parcel.length; i += 1) {
    const a = parcel[i]!;
    const b = parcel[(i + 1) % parcel.length]!;
    const heading = maps.geometry.spherical.computeHeading(
      new maps.LatLng(a),
      new maps.LatLng(b),
    );
    const normalized = ((heading % 180) + 180) % 180;
    values.add(Math.round(normalized * 10) / 10);
    values.add(Math.round((((normalized + 90) % 180) * 10)) / 10);
  }

  return [...values].sort((a, b) => a - b);
}

function candidateCenters(
  maps: typeof google.maps,
  parcel: LatLngPoint[],
  maxCenters: number,
): google.maps.LatLng[] {
  const originPoint = centroid(parcel);
  const origin = new maps.LatLng(originPoint);
  const xy = parcel.map((point) => toXY(point, originPoint));
  const minX = Math.min(...xy.map((point) => point.x));
  const maxX = Math.max(...xy.map((point) => point.x));
  const minY = Math.min(...xy.map((point) => point.y));
  const maxY = Math.max(...xy.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const targetStep = Math.sqrt((width * height) / Math.max(1, maxCenters));
  const step = Math.max(1.5, Math.min(12, targetStep));

  const centers: google.maps.LatLng[] = [origin];
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      centers.push(localToLatLng(maps, origin, x, y, 0, false));
      if (centers.length >= maxCenters) return centers;
    }
  }
  return centers;
}

export function findBestPlacement(
  maps: typeof google.maps,
  parcel: LatLngPoint[],
  selection: TemplateSelection,
  options?: { maxCenters?: number; angleStep?: number },
): AutoPlacement | null {
  if (parcel.length < 3) return null;
  const definition = buildTemplateDefinition(selection);
  const maxCenters = options?.maxCenters ?? 260;
  const angleStep = options?.angleStep ?? 10;
  const centers = candidateCenters(maps, parcel, maxCenters);
  const angles = candidateAngles(maps, parcel, angleStep);

  let best: AutoPlacement | null = null;

  for (const center of centers) {
    for (const rotation of angles) {
      const corners = rectPath(maps, center, definition.outerRect, rotation, false).map((point) => ({
        lat: point.lat(),
        lng: point.lng(),
      }));
      if (!polygonContainsPolygon(parcel, corners)) continue;

      const clearanceScore = minCornerClearance(parcel, corners);
      if (!best || clearanceScore > best.clearanceScore) {
        best = {
          definition,
          center: { lat: center.lat(), lng: center.lng() },
          rotation,
          flipped: false,
          clearanceScore,
        };
      }
    }
  }

  return best;
}

const GROUND_CONFIGS: Array<Pick<TemplateSelection, "series" | "parallel">> = [
  { series: "S2", parallel: "R2" },
  { series: "S2", parallel: "R1" },
  { series: "S1", parallel: "R2" },
  { series: "S1", parallel: "R1" },
];

export function findMaximumConfiguration(
  maps: typeof google.maps,
  parcel: LatLngPoint[],
  height: TemplateSelection["height"],
  options?: { maxCenters?: number; angleStep?: number },
): MaxConfigurationResult {
  const testedCodes: string[] = [];
  for (const ground of GROUND_CONFIGS) {
    const selection: TemplateSelection = { height, ...ground };
    testedCodes.push(`${height} ${ground.series} ${ground.parallel}`);
    const placement = findBestPlacement(maps, parcel, selection, options);
    if (placement) return { placement, testedCodes };
  }
  return { placement: null, testedCodes };
}
