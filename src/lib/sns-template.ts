/// <reference types="google.maps" />

/**
 * H1 S1 R1 SNS site template geometry.
 *
 * Local coordinate system, in metres, origin at the template centre:
 *   +x = across the width (b -> A -> B in normal orientation)
 *   +y = towards the front of the template (away from the rear bike lane)
 */

export const TEMPLATE_WIDTH = 9.94;
export const TEMPLATE_DEPTH = 15.8;
export const TEMPLATE_AREA = TEMPLATE_WIDTH * TEMPLATE_DEPTH; // 157.052 m²

const HALF_W = TEMPLATE_WIDTH / 2; // 4.97
const HALF_D = TEMPLATE_DEPTH / 2; // 7.90

/** Depth split: 1.80 m rear bike lane, then the 14.00 m main block. */
const REAR_Y0 = -HALF_D; // -7.90
const REAR_Y1 = -HALF_D + 1.8; // -6.10
const BLOCK_Y0 = REAR_Y1; // -6.10
const BLOCK_Y1 = HALF_D; // 7.90

/** Width split: b 2.50 | A 2.44 | B 5.00 */
const B_BIKE_X0 = -HALF_W; // -4.97
const B_BIKE_X1 = B_BIKE_X0 + 2.5; // -2.47
const A_X0 = B_BIKE_X1;
const A_X1 = A_X0 + 2.44; // -0.03
const B_OPS_X0 = A_X1;
const B_OPS_X1 = HALF_W; // 4.97

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
};

export const OUTER_RECT: Rect = { x0: -HALF_W, x1: HALF_W, y0: -HALF_D, y1: HALF_D };

export const ZONES: ZoneStyle[] = [
  {
    key: "b",
    rect: { x0: B_BIKE_X0, x1: B_BIKE_X1, y0: BLOCK_Y0, y1: BLOCK_Y1 },
    stroke: "#f59e0b",
    fill: "#fbbf24",
    fillOpacity: 0.35,
    strokeWeight: 2,
    zIndex: 11,
    label: "b — BIKE SIDE 2.5 m",
    labelColor: "#fde68a",
  },
  {
    key: "A",
    rect: { x0: A_X0, x1: A_X1, y0: BLOCK_Y0, y1: BLOCK_Y1 },
    stroke: "#a855f7",
    fill: "#c084fc",
    fillOpacity: 0.4,
    strokeWeight: 2,
    zIndex: 11,
    label: "A — POD",
    labelColor: "#e9d5ff",
  },
  {
    key: "A-cap-rear",
    rect: { x0: A_X0, x1: A_X1, y0: BLOCK_Y0, y1: BLOCK_Y0 + 1 },
    stroke: "#7e22ce",
    fill: "#7e22ce",
    fillOpacity: 0.3,
    strokeWeight: 1,
    zIndex: 12,
    label: "E",
    labelColor: "#f3e8ff",
    labelSize: "10px",
  },
  {
    key: "A-cap-front",
    rect: { x0: A_X0, x1: A_X1, y0: BLOCK_Y1 - 1, y1: BLOCK_Y1 },
    stroke: "#7e22ce",
    fill: "#7e22ce",
    fillOpacity: 0.3,
    strokeWeight: 1,
    zIndex: 12,
    label: "E",
    labelColor: "#f3e8ff",
    labelSize: "10px",
  },
  {
    key: "B",
    rect: { x0: B_OPS_X0, x1: B_OPS_X1, y0: BLOCK_Y0, y1: BLOCK_Y1 },
    stroke: "#22c55e",
    fill: "#4ade80",
    fillOpacity: 0.3,
    strokeWeight: 2,
    zIndex: 11,
    label: "B — MAIN OPERATIONS",
    labelColor: "#bbf7d0",
  },
  {
    key: "rear-bike",
    rect: { x0: -HALF_W, x1: HALF_W, y0: REAR_Y0, y1: REAR_Y1 },
    stroke: "#3b82f6",
    fill: "#60a5fa",
    fillOpacity: 0.35,
    strokeWeight: 2,
    zIndex: 11,
    label: "1.8 m BIKE-ONLY CONNECTION",
    labelColor: "#dbeafe",
    labelSize: "11px",
  },
  {
    key: "X",
    rect: { x0: B_OPS_X0 + 0.5, x1: B_OPS_X0 + 4.5, y0: BLOCK_Y0 + 0.5, y1: BLOCK_Y0 + 4.5 },
    stroke: "#f43f5e",
    fill: "#fb7185",
    fillOpacity: 0.4,
    strokeWeight: 2,
    zIndex: 13,
    label: "X — UTILITY",
    labelColor: "#ffe4e6",
    labelSize: "11px",
  },
  {
    key: "generator",
    rect: { x0: B_OPS_X0 + 1, x1: B_OPS_X0 + 4, y0: BLOCK_Y0 + 5.1, y1: BLOCK_Y0 + 6.2 },
    stroke: "#94a3b8",
    fill: "#cbd5e1",
    fillOpacity: 0.45,
    strokeWeight: 1.5,
    zIndex: 13,
    label: "GENERATOR",
    labelColor: "#e2e8f0",
    labelSize: "10px",
  },
];

/** Distance from the template centre to the rotation handle, in metres. */
export const ROTATION_HANDLE_OFFSET = HALF_D + 6;

const toRad = (deg: number) => (deg * Math.PI) / 180;
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

export { toRad };
