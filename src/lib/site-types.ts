export type HeightCode = "H1" | "H2" | "H3";
export type SeriesCode = "S1" | "S2";
export type ParallelCode = "R1" | "R2";

export type TemplateSelection = {
  height: HeightCode;
  series: SeriesCode;
  parallel: ParallelCode;
};

export type TemplateFitState = "idle" | "pass" | "fail";
export type ZoneCheckState = "idle" | "pass" | "fail";

export type OperationalChecks = {
  bikeCirculation: ZoneCheckState;
  utilityX: ZoneCheckState;
  generator: ZoneCheckState;
  bOperational: ZoneCheckState;
};

export const IDLE_OPERATIONAL_CHECKS: OperationalChecks = {
  bikeCirculation: "idle",
  utilityX: "idle",
  generator: "idle",
  bOperational: "idle",
};

export type RoadInfo = {
  edgeIndex: number;
  lengthMeters: number;
};

export type GateInfo = {
  lat: number;
  lng: number;
};

export type AccessType = "single-in-out" | "front-entry-side-exit" | "truck-drive-through";

export type AutoFitMessage = {
  state: "idle" | "working" | "found" | "not-found";
  title: string;
  detail: string;
};

export type OpenLandCandidate = {
  id: string;
  sourceId: string;
  path: Array<{ lat: number; lng: number }>;
  center: { lat: number; lng: number };
  areaM2: number;
  cents: number;
  kind: string;
  name: string | null;
  confidence: "high" | "medium" | "low";
  roadAdjacent: boolean;
  roadDistanceMeters: number | null;
  maxConfiguration: string | null;
  maxPlacement: {
    center: { lat: number; lng: number };
    rotation: number;
    flipped: boolean;
    selection: TemplateSelection;
  } | null;
};

export type LandScanMessage = {
  state: "idle" | "working" | "done" | "error";
  title: string;
  detail: string;
};

// Legacy internal access-screen types retained for compatibility with the map component.
// The visual Bada Dost screening feature is disabled in the current dashboard.
export type AccessDimensionStatus = "unknown" | "pass" | "conditional" | "fail";
export type AccessScreenState = "idle" | "pass" | "conditional" | "fail";
export type BadaDostScreenInfo = {
  state: AccessScreenState;
  corridorFitsParcel: boolean | null;
  blockedByTemplate: boolean | null;
  corridorLengthMeters: number | null;
  corridorWidthMeters: number;
  gateWidthStatus: AccessDimensionStatus;
  roadWidthStatus: AccessDimensionStatus;
  reason: string;
};
