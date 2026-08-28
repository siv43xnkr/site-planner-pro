/// <reference types="google.maps" />

import { findMaximumConfiguration, type LatLngPoint } from "@/lib/auto-fit";
import type { HeightCode, OpenLandCandidate } from "@/lib/site-types";

const SQM_PER_CENT = 40.4686;
const MIN_CANDIDATE_AREA_M2 = 145;
const MAX_CANDIDATE_AREA_M2 = 25000;
const ROAD_NEAR_M = 30;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassGeometryPoint = { lat: number; lon: number };
type OverpassElement = {
  id: number;
  type: string;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
};
type OverpassResponse = { elements?: OverpassElement[] };

type BoundsLiteral = { south: number; west: number; north: number; east: number };

type RoadLine = LatLngPoint[];

function localXY(point: LatLngPoint, origin: LatLngPoint) {
  const r = 6371008.8;
  const lat0 = (origin.lat * Math.PI) / 180;
  return {
    x: r * ((point.lng - origin.lng) * Math.PI / 180) * Math.cos(lat0),
    y: r * ((point.lat - origin.lat) * Math.PI / 180),
  };
}

function pointSegmentDistanceMeters(point: LatLngPoint, a: LatLngPoint, b: LatLngPoint) {
  const p = localXY(point, point);
  const p1 = localXY(a, point);
  const p2 = localXY(b, point);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const denom = dx * dx + dy * dy;
  if (denom === 0) return Math.hypot(p1.x - p.x, p1.y - p.y);
  const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / denom));
  return Math.hypot(p.x - (p1.x + t * dx), p.y - (p1.y + t * dy));
}

function roadDistance(path: LatLngPoint[], roads: RoadLine[]): number {
  let best = Number.POSITIVE_INFINITY;
  const samples = path.length > 20 ? path.filter((_, index) => index % Math.ceil(path.length / 20) === 0) : path;
  for (const point of samples) {
    for (const road of roads) {
      for (let i = 0; i < road.length - 1; i += 1) {
        best = Math.min(best, pointSegmentDistanceMeters(point, road[i]!, road[i + 1]!));
        if (best <= 3) return best;
      }
    }
  }
  return best;
}

function confidenceFor(tags: Record<string, string> | undefined): OpenLandCandidate["confidence"] {
  const landuse = tags?.["landuse"] ?? "";
  if (landuse === "brownfield" || landuse === "greenfield") return "high";
  if (landuse === "grass" || landuse === "meadow") return "medium";
  return "low";
}

function candidateKind(tags: Record<string, string> | undefined): string {
  return tags?.["landuse"] ?? tags?.["natural"] ?? "open-land";
}

function centroid(path: LatLngPoint[]) {
  return path.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat / path.length, lng: acc.lng + point.lng / path.length }),
    { lat: 0, lng: 0 },
  );
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`Open-land service returned ${response.status}.`);
      return (await response.json()) as OverpassResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Open-land service failed.");
    }
  }
  throw lastError ?? new Error("Open-land service is unavailable.");
}

export async function scanOpenLand(
  maps: typeof google.maps,
  bounds: BoundsLiteral,
  height: HeightCode,
): Promise<OpenLandCandidate[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:25];
(
  way["landuse"~"^(brownfield|greenfield|grass|meadow|farmland)$"](${bbox});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street)$"](${bbox});
);
out tags geom;`;

  const data = await fetchOverpass(query);
  const elements = data.elements ?? [];
  const roadLines: RoadLine[] = elements
    .filter((element) => Boolean(element.tags?.["highway"]) && (element.geometry?.length ?? 0) >= 2)
    .map((element) => element.geometry!.map((point) => ({ lat: point.lat, lng: point.lon })));

  const landWays = elements.filter(
    (element) => Boolean(element.tags?.["landuse"]) && (element.geometry?.length ?? 0) >= 3,
  );

  const candidates: OpenLandCandidate[] = [];
  for (const element of landWays) {
    const path = element.geometry!.map((point) => ({ lat: point.lat, lng: point.lon }));
    const mvcPath = new maps.MVCArray(path.map((point) => new maps.LatLng(point)));
    const areaM2 = maps.geometry.spherical.computeArea(mvcPath);
    if (areaM2 < MIN_CANDIDATE_AREA_M2 || areaM2 > MAX_CANDIDATE_AREA_M2) continue;

    const roadDistanceMeters = roadDistance(path, roadLines);
    const roadAdjacent = roadDistanceMeters <= ROAD_NEAR_M;
    const maxResult = findMaximumConfiguration(maps, path, height, {
      maxCenters: 90,
      angleStep: 15,
    });

    candidates.push({
      id: `osm-way-${element.id}`,
      sourceId: String(element.id),
      path,
      center: centroid(path),
      areaM2,
      cents: areaM2 / SQM_PER_CENT,
      kind: candidateKind(element.tags),
      name: element.tags?.["name"] ?? null,
      confidence: confidenceFor(element.tags),
      roadAdjacent,
      roadDistanceMeters: Number.isFinite(roadDistanceMeters) ? roadDistanceMeters : null,
      maxConfiguration: maxResult.placement?.definition.code ?? null,
      maxPlacement: maxResult.placement
        ? {
            center: maxResult.placement.center,
            rotation: maxResult.placement.rotation,
            flipped: maxResult.placement.flipped,
            selection: maxResult.placement.definition.selection,
          }
        : null,
    });
  }

  const configurationScore = (code: string | null) => {
    if (!code) return 0;
    if (code.endsWith("S2 R2")) return 4;
    if (code.endsWith("S2 R1")) return 3;
    if (code.endsWith("S1 R2")) return 2;
    if (code.endsWith("S1 R1")) return 1;
    return 0;
  };

  return candidates
    .sort((a, b) => {
      const roadScore = Number(b.roadAdjacent) - Number(a.roadAdjacent);
      if (roadScore !== 0) return roadScore;
      const fitScore = configurationScore(b.maxConfiguration) - configurationScore(a.maxConfiguration);
      if (fitScore !== 0) return fitScore;
      const confidenceScore = { high: 3, medium: 2, low: 1 } as const;
      const confidenceDelta = confidenceScore[b.confidence] - confidenceScore[a.confidence];
      if (confidenceDelta !== 0) return confidenceDelta;
      return a.areaM2 - b.areaM2;
    })
    .slice(0, 20);
}
