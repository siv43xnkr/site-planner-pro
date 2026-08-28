/// <reference types="google.maps" />

import type { TemplateSelection } from "@/lib/site-types";

/**
 * SNS compact site-template geometry.
 *
 * Local coordinate system, in metres, origin at the template centre:
 *   +x = across the width (b -> A -> B in normal orientation)
 *   +y = towards the front of the template (away from the rear bike lane)
 *
 * Ground footprint is driven by S and R. H is retained in the selected
 * configuration code but does not change the current ground geometry.
 */

export type Rect = { x0: number; x1: number; y0: number; y1: number };

export type ZoneStyle = {
  key: string;
  rect: Rect;
  stroke: string;
  fill: string;
  fillOpacity: number;
  strokeWeight: number;
  zIndex: number;
  label?: string;
  labelColor?: string;
  labelSize?: string;
  labelMinZoom?: number;
};

export type TemplateDefinition = {
  code: string;
  selection: TemplateSelection;
  width: number;
  depth: number;
  area: number;
  cents: number;
  podLength: number;
  podWidth: number;
  outerRect: Rect;
  zones: ZoneStyle[];
  rotationHandleOffset: number;
};

const CONTAINER_LENGTH_M = 12.192;
const END_CAP_UTILITY_M = 2.5;
const END_CAP_OPPOSITE_M = 1.5;
const CONTAINER_WIDTH_M = 2.438;
const BIKE_SIDE_WIDTH_M = 2.5;
const B_OPS_WIDTH_M = 5;
const REAR_BIKE_DEPTH_M = 1.8;
const SQM_PER_CENT = 40.4686;

function indexFromCode(value: "S1" | "S2" | "R1" | "R2") {
  return value.endsWith("2") ? 2 : 1;
}

export function buildTemplateDefinition(selection: TemplateSelection): TemplateDefinition {
  const s = indexFromCode(selection.series);
  const r = indexFromCode(selection.parallel);

  const podLength = s * CONTAINER_LENGTH_M + END_CAP_UTILITY_M + END_CAP_OPPOSITE_M;
  const podWidth = r * CONTAINER_WIDTH_M;
  const width = BIKE_SIDE_WIDTH_M + podWidth + B_OPS_WIDTH_M;
  const depth = podLength + REAR_BIKE_DEPTH_M;
  const area = width * depth;

  const halfW = width / 2;
  const halfD = depth / 2;

  const rearY0 = -halfD;
  const rearY1 = rearY0 + REAR_BIKE_DEPTH_M;
  const blockY0 = rearY1;
  const blockY1 = halfD;

  const bikeX0 = -halfW;
  const bikeX1 = bikeX0 + BIKE_SIDE_WIDTH_M;
  const podX0 = bikeX1;
  const podX1 = podX0 + podWidth;
  const opsX0 = podX1;
  const opsX1 = halfW;

  const code = `${selection.height} ${selection.series} ${selection.parallel}`;

  const zones: ZoneStyle[] = [
    {
      key: "b",
      rect: { x0: bikeX0, x1: bikeX1, y0: blockY0, y1: blockY1 },
      stroke: "#f59e0b",
      fill: "#fbbf24",
      fillOpacity: 0.3,
      strokeWeight: 2,
      zIndex: 11,
      label: "b - BIKE SIDE 2.5 m",
      labelColor: "#fde68a",
      labelMinZoom: 20,
    },
    {
      key: "A",
      rect: { x0: podX0, x1: podX1, y0: blockY0, y1: blockY1 },
      stroke: "#a855f7",
      fill: "#c084fc",
      fillOpacity: 0.36,
      strokeWeight: 2,
      zIndex: 11,
      label: `A - POD ${selection.series} ${selection.parallel}`,
      labelColor: "#e9d5ff",
      labelMinZoom: 20,
    },
    {
      key: "A-cap-rear",
      rect: { x0: podX0, x1: podX1, y0: blockY0, y1: blockY0 + END_CAP_UTILITY_M },
      stroke: "#7e22ce",
      fill: "#7e22ce",
      fillOpacity: 0.28,
      strokeWeight: 1,
      zIndex: 12,
      label: "E 2.50",
      labelColor: "#f3e8ff",
      labelSize: "10px",
      labelMinZoom: 22,
    },
    {
      key: "A-cap-front",
      rect: { x0: podX0, x1: podX1, y0: blockY1 - END_CAP_OPPOSITE_M, y1: blockY1 },
      stroke: "#7e22ce",
      fill: "#7e22ce",
      fillOpacity: 0.28,
      strokeWeight: 1,
      zIndex: 12,
      label: "E 1.50",
      labelColor: "#f3e8ff",
      labelSize: "10px",
      labelMinZoom: 22,
    },
    {
      key: "B",
      rect: { x0: opsX0, x1: opsX1, y0: blockY0, y1: blockY1 },
      stroke: "#22c55e",
      fill: "#4ade80",
      fillOpacity: 0.28,
      strokeWeight: 2,
      zIndex: 11,
      label: "B - MAIN OPERATIONS",
      labelColor: "#bbf7d0",
      labelMinZoom: 20,
    },
    {
      key: "rear-bike",
      rect: { x0: -halfW, x1: halfW, y0: rearY0, y1: rearY1 },
      stroke: "#3b82f6",
      fill: "#60a5fa",
      fillOpacity: 0.32,
      strokeWeight: 2,
      zIndex: 11,
      label: "1.8 m BIKE-ONLY CONNECTION",
      labelColor: "#dbeafe",
      labelSize: "10px",
      labelMinZoom: 20,
    },
    {
      key: "X",
      rect: { x0: opsX0 + 0.5, x1: opsX0 + 4.5, y0: blockY0 + 0.5, y1: blockY0 + 4.5 },
      stroke: "#f43f5e",
      fill: "#fb7185",
      fillOpacity: 0.4,
      strokeWeight: 2,
      zIndex: 13,
      label: "X - UTILITY",
      labelColor: "#ffe4e6",
      labelSize: "10px",
      labelMinZoom: 21,
    },
    {
      key: "generator",
      rect: { x0: opsX0 + 1, x1: opsX0 + 4, y0: blockY0 + 5.1, y1: blockY0 + 6.2 },
      stroke: "#94a3b8",
      fill: "#cbd5e1",
      fillOpacity: 0.45,
      strokeWeight: 1.5,
      zIndex: 13,
      label: "GENERATOR",
      labelColor: "#e2e8f0",
      labelSize: "9px",
      labelMinZoom: 21,
    },
  ];

  return {
    code,
    selection,
    width,
    depth,
    area,
    cents: area / SQM_PER_CENT,
    podLength,
    podWidth,
    outerRect: { x0: -halfW, x1: halfW, y0: -halfD, y1: halfD },
    zones,
    rotationHandleOffset: halfD + 6,
  };
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Converts a local metre offset into a real geographic position. */
export function localToLatLng(
  maps: typeof google.maps,
  center: google.maps.LatLng | google.maps.LatLngLiteral,
  x: number,
  y: number,
  rotationDeg: number,
  flipped: boolean,
): google.maps.LatLng {
  const fx = flipped ? -x : x;
  const distance = Math.hypot(fx, y);
  const heading = rotationDeg + toDeg(Math.atan2(fx, y));
  const origin = center instanceof maps.LatLng ? center : new maps.LatLng(center);
  if (distance === 0) return origin;
  return maps.geometry.spherical.computeOffset(origin, distance, heading);
}

export function rectPath(
  maps: typeof google.maps,
  center: google.maps.LatLng | google.maps.LatLngLiteral,
  rect: Rect,
  rotationDeg: number,
  flipped: boolean,
): google.maps.LatLng[] {
  return (
    [
      [rect.x0, rect.y0],
      [rect.x1, rect.y0],
      [rect.x1, rect.y1],
      [rect.x0, rect.y1],
    ] as const
  ).map(([x, y]) => localToLatLng(maps, center, x, y, rotationDeg, flipped));
}

export function rectCentre(rect: Rect) {
  return { x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2 };
}

/** Heading, in degrees, from the template centre to a dragged handle position. */
export function headingFromCentre(
  maps: typeof google.maps,
  center: google.maps.LatLng | google.maps.LatLngLiteral,
  point: google.maps.LatLng,
): number {
  const origin = center instanceof maps.LatLng ? center : new maps.LatLng(center);
  const heading = maps.geometry.spherical.computeHeading(origin, point);
  return ((heading % 360) + 360) % 360;
}
