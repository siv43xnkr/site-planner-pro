/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Satellite,
  Map as MapIcon,
  PencilRuler,
  Eraser,
  Route,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  MapPin,
  RotateCcw,
  RotateCw,
  Move,
  Save,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";
import { polygonContainsPolygon } from "@/lib/geo-fit";
import { nearestPolygonEdgeIndex, pointProjectionFractionOnSegment } from "@/lib/geo-road";
import {
  ABSOLUTE_GATE_MIN_M,
  ACCESS_CORRIDOR_WIDTH_M,
  PREFERRED_GATE_MIN_M,
  ROAD_SCREEN_PASS_M,
  buildCorridorPath,
  polygonsOverlap,
} from "@/lib/geo-access";
import type {
  AccessDimensionStatus,
  AccessType,
  BadaDostScreenInfo,
  GateInfo,
  OperationalChecks,
  RoadInfo,
  TemplateFitState,
  TemplateSelection,
  AutoFitMessage,
} from "@/lib/site-types";
import { IDLE_OPERATIONAL_CHECKS } from "@/lib/site-types";
import type { PlannerMapSnapshot } from "@/lib/saved-sites";
import { findBestPlacement, findMaximumConfiguration, type AutoPlacement } from "@/lib/auto-fit";
import {
  buildTemplateDefinition,
  headingFromCentre,
  localToLatLng,
  rectCentre,
  rectPath,
} from "@/lib/sns-template";

const PARCEL_STROKE = "#22d3ee";
const TEMPLATE_STROKE_IDLE = "#f8fafc";
const TEMPLATE_STROKE_PASS = "#22c55e";
const TEMPLATE_STROKE_FAIL = "#ef4444";
const ROAD_STROKE = "#f59e0b";
const GATE_STROKE = "#facc15";
const ACCESS_PASS = "#22c55e";
const ACCESS_WARN = "#f59e0b";
const ACCESS_FAIL = "#ef4444";
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

type Suggestion = { placeId: string; primary: string; secondary: string };

type RoadObjects = {
  line: google.maps.Polyline | null;
  label: google.maps.Marker | null;
};

const emptyRoad = (): RoadObjects => ({ line: null, label: null });

type GateObjects = {
  segment: google.maps.Polyline | null;
  marker: google.maps.Marker | null;
  label: google.maps.Marker | null;
};

const emptyGate = (): GateObjects => ({ segment: null, marker: null, label: null });

type AccessObjects = {
  corridor: google.maps.Polygon | null;
  centreline: google.maps.Polyline | null;
  target: google.maps.Marker | null;
  label: google.maps.Marker | null;
};

const emptyAccess = (): AccessObjects => ({
  corridor: null,
  centreline: null,
  target: null,
  label: null,
});

type TemplateObjects = {
  outline: google.maps.Polygon | null;
  zones: google.maps.Polygon[];
  labels: google.maps.Marker[];
  move: google.maps.Marker | null;
  rotate: google.maps.Marker | null;
  rotateHit: google.maps.Circle | null;
  arm: google.maps.Polyline | null;
};

const emptyTemplate = (): TemplateObjects => ({
  outline: null,
  zones: [],
  labels: [],
  move: null,
  rotate: null,
  rotateHit: null,
  arm: null,
});

export function MapWorkspace({
  selection,
  onAutoSelectionChange,
  onAreaChange,
  placeNonce,
  flipNonce,
  bestFitNonce,
  maxConfigNonce,
  onTemplateChange,
  onTemplateFitChange,
  onOperationalChecksChange,
  onRoadChange,
  gateWidthMeters,
  roadWidthMeters,
  accessType,
  onGateChange,
  onBadaDostScreenChange,
  onAutoFitMessage,
  snapshotRequestNonce,
  restoreRequestNonce,
  restoreSnapshot,
  onSnapshotCaptured,
  savedSiteCount,
  onSaveSite,
  onOpenSavedSites,
}: {
  selection: TemplateSelection;
  onAutoSelectionChange: (selection: TemplateSelection) => void;
  onAreaChange: (area: number | null) => void;
  placeNonce: number;
  flipNonce: number;
  bestFitNonce: number;
  maxConfigNonce: number;
  onTemplateChange: (placed: boolean) => void;
  onTemplateFitChange: (fit: TemplateFitState) => void;
  onOperationalChecksChange: (checks: OperationalChecks) => void;
  onRoadChange: (road: RoadInfo | null) => void;
  gateWidthMeters: number | null;
  roadWidthMeters: number | null;
  accessType: AccessType;
  onGateChange: (gate: GateInfo | null) => void;
  onBadaDostScreenChange: (screen: BadaDostScreenInfo | null) => void;
  onAutoFitMessage: (message: AutoFitMessage) => void;
  snapshotRequestNonce: number;
  restoreRequestNonce: number;
  restoreSnapshot: PlannerMapSnapshot | null;
  onSnapshotCaptured: (snapshot: PlannerMapSnapshot) => void;
  savedSiteCount: number;
  onSaveSite: () => void;
  onOpenSavedSites: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const draftRef = useRef<{
    path: google.maps.LatLngLiteral[];
    line: google.maps.Polyline | null;
    markers: google.maps.Marker[];
  }>({ path: [], line: null, markers: [] });
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const roadListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const roadRef = useRef<RoadObjects>(emptyRoad());
  const roadEdgeIndexRef = useRef<number | null>(null);
  const gateRef = useRef<GateObjects>(emptyGate());
  const gateFractionRef = useRef<number | null>(null);
  const accessRef = useRef<AccessObjects>(emptyAccess());
  const accessEvaluatorRef = useRef<() => void>(() => undefined);
  const templateRef = useRef<TemplateObjects>(emptyTemplate());
  const pendingAutoPlacementRef = useRef<AutoPlacement | null>(null);
  const templateCenterRef = useRef<google.maps.LatLng | null>(null);
  const rotationRef = useRef(0);
  const flippedRef = useRef(false);
  const interactionModeRef = useRef<"move" | "rotate">("move");
  const definitionRef = useRef(buildTemplateDefinition(selection));
  definitionRef.current = buildTemplateDefinition(selection);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    hasGoogleMapsKey ? "loading" : "unconfigured",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [satellite, setSatellite] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [hasParcel, setHasParcel] = useState(false);
  const [roadMode, setRoadMode] = useState(false);
  const [hasRoad, setHasRoad] = useState(false);
  const [gateMode, setGateMode] = useState(false);
  const [hasGate, setHasGate] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [autoPlacementTick, setAutoPlacementTick] = useState(0);
  const [hasTemplateControls, setHasTemplateControls] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"move" | "rotate">("move");

  const chooseInteractionMode = useCallback((mode: "move" | "rotate") => {
    interactionModeRef.current = mode;
    setInteractionMode(mode);
  }, []);

  const updateTemplateLabelsForZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom() ?? 17;
    const definition = definitionRef.current;
    let labelIndex = 0;
    definition.zones.forEach((zone) => {
      if (!zone.label) return;
      templateRef.current.labels[labelIndex]?.setVisible(zoom >= (zone.labelMinZoom ?? 20));
      labelIndex += 1;
    });
  }, []);

  /* ---------------- map init ---------------- */
  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let cancelled = false;
    let zoomListener: google.maps.MapsEventListener | null = null;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 17,
          mapTypeId: "satellite",
          tilt: 0,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          clickableIcons: false,
        });
        zoomListener = mapRef.current.addListener("zoom_changed", updateTemplateLabelsForZoom);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMessage(err.message || "Google Maps could not be loaded.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
      zoomListener?.remove();
    };
  }, [updateTemplateLabelsForZoom]);

  useEffect(() => {
    mapRef.current?.setMapTypeId(satellite ? "satellite" : "roadmap");
  }, [satellite]);

  const clearAccessOverlay = useCallback(() => {
    accessRef.current.corridor?.setMap(null);
    accessRef.current.centreline?.setMap(null);
    accessRef.current.target?.setMap(null);
    accessRef.current.label?.setMap(null);
    accessRef.current = emptyAccess();
    onBadaDostScreenChange(null);
  }, [onBadaDostScreenChange]);

  const scheduleAccessEvaluation = useCallback(() => {
    window.requestAnimationFrame(() => accessEvaluatorRef.current());
  }, []);

  /* ---------------- road + gate mapping ---------------- */
  const clearGatePickListeners = useCallback(() => {
    roadListenersRef.current.forEach((listener) => listener.remove());
    roadListenersRef.current = [];
    mapRef.current?.setOptions({ draggableCursor: null });
  }, []);

  const clearGate = useCallback(() => {
    clearGatePickListeners();
    clearAccessOverlay();
    gateRef.current.segment?.setMap(null);
    gateRef.current.marker?.setMap(null);
    gateRef.current.label?.setMap(null);
    gateRef.current = emptyGate();
    gateFractionRef.current = null;
    setGateMode(false);
    setHasGate(false);
    onGateChange(null);
  }, [clearAccessOverlay, clearGatePickListeners, onGateChange]);

  const clearRoadPickListeners = useCallback(() => {
    roadListenersRef.current.forEach((listener) => listener.remove());
    roadListenersRef.current = [];
    mapRef.current?.setOptions({ draggableCursor: null });
  }, []);

  const clearRoad = useCallback(() => {
    clearRoadPickListeners();
    clearGate();
    roadRef.current.line?.setMap(null);
    roadRef.current.label?.setMap(null);
    roadRef.current = emptyRoad();
    roadEdgeIndexRef.current = null;
    setRoadMode(false);
    setHasRoad(false);
    onRoadChange(null);
  }, [clearGate, clearRoadPickListeners, onRoadChange]);

  const updateRoadOverlay = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const parcel = polygonRef.current;
    const edgeIndex = roadEdgeIndexRef.current;
    if (!maps || !map || !parcel || edgeIndex === null) return;

    const path = parcel.getPath().getArray();
    if (path.length < 2 || edgeIndex < 0 || edgeIndex >= path.length) {
      clearRoad();
      return;
    }

    const start = path[edgeIndex]!;
    const end = path[(edgeIndex + 1) % path.length]!;
    const road = roadRef.current;

    if (!road.line) {
      road.line = new maps.Polyline({
        map,
        path: [start, end],
        strokeColor: ROAD_STROKE,
        strokeOpacity: 1,
        strokeWeight: 6,
        clickable: false,
        zIndex: 40,
      });
    } else {
      road.line.setPath([start, end]);
    }

    const midpoint = maps.geometry.spherical.interpolate(start, end, 0.5);
    if (!road.label) {
      road.label = new maps.Marker({
        map,
        position: midpoint,
        clickable: false,
        zIndex: 45,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 0,
          fillOpacity: 0,
          strokeOpacity: 0,
        },
        label: {
          text: "ROAD ACCESS",
          color: "#fef3c7",
          fontSize: "12px",
          fontWeight: "700",
        },
      });
    } else {
      road.label.setPosition(midpoint);
    }

    const lengthMeters = maps.geometry.spherical.computeDistanceBetween(start, end);
    setHasRoad(true);
    onRoadChange({ edgeIndex, lengthMeters });
  }, [clearRoad, onRoadChange]);

  const updateGateOverlay = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const parcel = polygonRef.current;
    const edgeIndex = roadEdgeIndexRef.current;
    const fraction = gateFractionRef.current;
    if (!maps || !map || !parcel || edgeIndex === null || fraction === null) return;

    const path = parcel.getPath().getArray();
    if (path.length < 2 || edgeIndex < 0 || edgeIndex >= path.length) {
      clearGate();
      return;
    }

    const start = path[edgeIndex]!;
    const end = path[(edgeIndex + 1) % path.length]!;
    const lengthMeters = maps.geometry.spherical.computeDistanceBetween(start, end);
    const centre = maps.geometry.spherical.interpolate(start, end, fraction);
    const gate = gateRef.current;

    if (!gate.marker) {
      gate.marker = new maps.Marker({
        map,
        position: centre,
        draggable: true,
        title: "Drag along the road edge to move the gate",
        zIndex: 55,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: GATE_STROKE,
          fillOpacity: 1,
          strokeColor: "#0f172a",
          strokeWeight: 2,
        },
      });
      gate.marker.addListener("drag", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng || !polygonRef.current || roadEdgeIndexRef.current === null) return;
        const currentPath = polygonRef.current.getPath().getArray();
        const i = roadEdgeIndexRef.current;
        const a = currentPath[i]!;
        const b = currentPath[(i + 1) % currentPath.length]!;
        gateFractionRef.current = pointProjectionFractionOnSegment(
          { lat: event.latLng.lat(), lng: event.latLng.lng() },
          { lat: a.lat(), lng: a.lng() },
          { lat: b.lat(), lng: b.lng() },
        );
        updateGateOverlay();
      });
    } else {
      gate.marker.setPosition(centre);
    }

    if (!gate.label) {
      gate.label = new maps.Marker({
        map,
        position: centre,
        clickable: false,
        zIndex: 56,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
        label: { text: "GATE", color: "#fef9c3", fontSize: "11px", fontWeight: "700" },
      });
    } else {
      gate.label.setPosition(centre);
    }

    const width = gateWidthMeters && gateWidthMeters > 0 ? gateWidthMeters : null;
    if (width && lengthMeters > 0) {
      const halfFraction = width / 2 / lengthMeters;
      let f0 = Math.max(0, fraction - halfFraction);
      let f1 = Math.min(1, fraction + halfFraction);
      const targetFraction = Math.min(1, width / lengthMeters);
      if (f1 - f0 < targetFraction) {
        if (f0 === 0) f1 = Math.min(1, targetFraction);
        else if (f1 === 1) f0 = Math.max(0, 1 - targetFraction);
      }
      const gateStart = maps.geometry.spherical.interpolate(start, end, f0);
      const gateEnd = maps.geometry.spherical.interpolate(start, end, f1);
      if (!gate.segment) {
        gate.segment = new maps.Polyline({
          map,
          path: [gateStart, gateEnd],
          strokeColor: GATE_STROKE,
          strokeOpacity: 1,
          strokeWeight: 10,
          clickable: false,
          zIndex: 52,
        });
      } else {
        gate.segment.setMap(map);
        gate.segment.setPath([gateStart, gateEnd]);
      }
    } else {
      gate.segment?.setMap(null);
    }

    setHasGate(true);
    onGateChange({ lat: centre.lat(), lng: centre.lng() });
    scheduleAccessEvaluation();
  }, [clearGate, gateWidthMeters, onGateChange, scheduleAccessEvaluation]);

  useEffect(() => {
    if (gateFractionRef.current !== null) updateGateOverlay();
  }, [gateWidthMeters, updateGateOverlay]);

  const cancelGateMarking = useCallback(() => {
    clearGatePickListeners();
    setGateMode(false);
  }, [clearGatePickListeners]);

  const selectGatePoint = useCallback(
    (latLng: google.maps.LatLng) => {
      const parcel = polygonRef.current;
      const edgeIndex = roadEdgeIndexRef.current;
      if (!parcel || edgeIndex === null) return;
      const path = parcel.getPath().getArray();
      const start = path[edgeIndex]!;
      const end = path[(edgeIndex + 1) % path.length]!;
      gateFractionRef.current = pointProjectionFractionOnSegment(
        { lat: latLng.lat(), lng: latLng.lng() },
        { lat: start.lat(), lng: start.lng() },
        { lat: end.lat(), lng: end.lng() },
      );
      updateGateOverlay();
      cancelGateMarking();
    },
    [cancelGateMarking, updateGateOverlay],
  );

  const cancelRoadMarking = useCallback(() => {
    clearRoadPickListeners();
    setRoadMode(false);
  }, [clearRoadPickListeners]);

  const selectRoadEdge = useCallback(
    (latLng: google.maps.LatLng) => {
      const parcel = polygonRef.current;
      if (!parcel) return;
      const points = parcel
        .getPath()
        .getArray()
        .map((point) => ({ lat: point.lat(), lng: point.lng() }));
      const edgeIndex = nearestPolygonEdgeIndex(points, { lat: latLng.lat(), lng: latLng.lng() });
      if (edgeIndex < 0) return;
      clearGate();
      roadEdgeIndexRef.current = edgeIndex;
      updateRoadOverlay();
      cancelRoadMarking();
    },
    [cancelRoadMarking, clearGate, updateRoadOverlay],
  );

  const startRoadMarking = useCallback(() => {
    const map = mapRef.current;
    const parcel = polygonRef.current;
    if (!map || !parcel) return;

    setDrawing(false);
    clearRoadPickListeners();
    setRoadMode(true);
    map.setOptions({ draggableCursor: "crosshair" });

    const choose = (event: google.maps.MapMouseEvent) => {
      if (event.latLng) selectRoadEdge(event.latLng);
    };

    roadListenersRef.current.push(map.addListener("click", choose), parcel.addListener("click", choose));
  }, [clearRoadPickListeners, selectRoadEdge]);

  useEffect(() => {
    if (!roadMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelRoadMarking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelRoadMarking, roadMode]);

  const startGateMarking = useCallback(() => {
    const map = mapRef.current;
    if (!map || roadEdgeIndexRef.current === null) return;
    setDrawing(false);
    cancelRoadMarking();
    clearGatePickListeners();
    setGateMode(true);
    map.setOptions({ draggableCursor: "crosshair" });
    const choose = (event: google.maps.MapMouseEvent) => {
      if (event.latLng) selectGatePoint(event.latLng);
    };
    roadListenersRef.current.push(map.addListener("click", choose));
  }, [cancelRoadMarking, clearGatePickListeners, selectGatePoint]);

  useEffect(() => {
    if (!gateMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelGateMarking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelGateMarking, gateMode]);

  /* ---------------- physical fit ---------------- */
  const evaluateTemplateFit = useCallback(() => {
    const parcel = polygonRef.current;
    const outline = templateRef.current.outline;

    if (!parcel || !outline) {
      outline?.setOptions({ strokeColor: TEMPLATE_STROKE_IDLE });
      onTemplateFitChange("idle");
      return;
    }

    const parcelPoints = parcel
      .getPath()
      .getArray()
      .map((point) => ({ lat: point.lat(), lng: point.lng() }));
    const templatePoints = outline
      .getPath()
      .getArray()
      .map((point) => ({ lat: point.lat(), lng: point.lng() }));

    const fits = polygonContainsPolygon(parcelPoints, templatePoints);
    outline.setOptions({ strokeColor: fits ? TEMPLATE_STROKE_PASS : TEMPLATE_STROKE_FAIL });
    onTemplateFitChange(fits ? "pass" : "fail");
  }, [onTemplateFitChange]);

  const evaluateOperationalChecks = useCallback(() => {
    const parcel = polygonRef.current;
    const template = templateRef.current;
    const definition = definitionRef.current;

    if (!parcel || template.zones.length !== definition.zones.length) {
      onOperationalChecksChange(IDLE_OPERATIONAL_CHECKS);
      return;
    }

    const parcelPoints = parcel
      .getPath()
      .getArray()
      .map((point) => ({ lat: point.lat(), lng: point.lng() }));

    const zoneFits = (key: string) => {
      const index = definition.zones.findIndex((zone) => zone.key === key);
      const polygon = index >= 0 ? template.zones[index] : null;
      if (!polygon) return false;
      const points = polygon
        .getPath()
        .getArray()
        .map((point) => ({ lat: point.lat(), lng: point.lng() }));
      return polygonContainsPolygon(parcelPoints, points);
    };

    onOperationalChecksChange({
      bikeCirculation: zoneFits("b") && zoneFits("rear-bike") ? "pass" : "fail",
      utilityX: zoneFits("X") ? "pass" : "fail",
      generator: zoneFits("generator") ? "pass" : "fail",
      bOperational: zoneFits("B") ? "pass" : "fail",
    });
  }, [onOperationalChecksChange]);

  /* ---------------- vehicle access screening disabled ---------------- */
  // The Bada Dost corridor/screening visualization has been removed by user request.
  // Road and gate mapping remain available for site documentation.
  const evaluateBadaDostAccess = useCallback(() => {
    clearAccessOverlay();
  }, [clearAccessOverlay]);

  useEffect(() => {
    accessEvaluatorRef.current = evaluateBadaDostAccess;
    clearAccessOverlay();
    return () => {
      accessEvaluatorRef.current = () => undefined;
    };
  }, [clearAccessOverlay, evaluateBadaDostAccess]);

  /* ---------------- area ---------------- */
  const recalcArea = useCallback(() => {
    const maps = mapsRef.current;
    const polygon = polygonRef.current;
    if (!maps || !polygon) return;
    onAreaChange(maps.geometry.spherical.computeArea(polygon.getPath()));
    updateRoadOverlay();
    updateGateOverlay();
    evaluateTemplateFit();
    evaluateOperationalChecks();
    scheduleAccessEvaluation();
  }, [
    evaluateOperationalChecks,
    evaluateTemplateFit,
    onAreaChange,
    scheduleAccessEvaluation,
    updateGateOverlay,
    updateRoadOverlay,
  ]);

  /* ---------------- draft helpers ---------------- */
  const clearDraft = useCallback(() => {
    draftRef.current.line?.setMap(null);
    draftRef.current.markers.forEach((m) => m.setMap(null));
    draftRef.current = { path: [], line: null, markers: [] };
    listenersRef.current.forEach((l) => l.remove());
    listenersRef.current = [];
  }, []);

  const removeParcel = useCallback(() => {
    clearRoad();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setHasParcel(false);
    onAreaChange(null);
    templateRef.current.outline?.setOptions({ strokeColor: TEMPLATE_STROKE_IDLE });
    onTemplateFitChange("idle");
    onOperationalChecksChange(IDLE_OPERATIONAL_CHECKS);
  }, [clearRoad, onAreaChange, onOperationalChecksChange, onTemplateFitChange]);

  const setParcelPath = useCallback((path: google.maps.LatLngLiteral[], editable = true) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || path.length < 3) return;

    clearRoad();
    polygonRef.current?.setMap(null);
    const polygon = new maps.Polygon({
      paths: path,
      map,
      strokeColor: PARCEL_STROKE,
      strokeWeight: 2.5,
      strokeOpacity: 1,
      fillColor: PARCEL_STROKE,
      fillOpacity: 0.12,
      editable,
      draggable: false,
      zIndex: 5,
    });
    polygonRef.current = polygon;

    const p = polygon.getPath();
    ["set_at", "insert_at", "remove_at"].forEach((evt) =>
      maps.event.addListener(p, evt, () => recalcArea()),
    );

    setHasParcel(true);
    recalcArea();
  }, [clearRoad, recalcArea]);

  const finishPolygon = useCallback(() => {
    const path = draftRef.current.path;
    if (path.length < 3) return;
    setParcelPath(path, true);
    clearDraft();
    setDrawing(false);
  }, [clearDraft, setParcelPath]);

  const startDrawing = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    removeParcel();
    clearDraft();
    setDrawing(true);

    const line = new maps.Polyline({
      map,
      path: [],
      strokeColor: PARCEL_STROKE,
      strokeWeight: 2.5,
      strokeOpacity: 1,
      zIndex: 4,
    });
    draftRef.current.line = line;

    const vertexIcon: google.maps.Symbol = {
      path: maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: "#ffffff",
      fillOpacity: 1,
      strokeColor: PARCEL_STROKE,
      strokeWeight: 2,
    };

    const addVertex = (latLng: google.maps.LatLng) => {
      const point = { lat: latLng.lat(), lng: latLng.lng() };
      const draft = draftRef.current;

      if (draft.path.length >= 3) {
        const first = draft.path[0]!;
        const px = map.getProjection();
        const meters = maps.geometry.spherical.computeDistanceBetween(
          new maps.LatLng(first),
          latLng,
        );
        const zoom = map.getZoom() ?? 17;
        const threshold = px ? (30 * 156543.03392) / Math.pow(2, zoom) / 10 : 5;
        if (meters < Math.max(threshold, 1.5)) {
          finishPolygon();
          return;
        }
      }

      draft.path.push(point);
      draft.line?.setPath(draft.path);
      const marker = new maps.Marker({
        position: point,
        map,
        icon: vertexIcon,
        clickable: true,
        zIndex: 6,
      });
      if (draft.path.length === 1) {
        marker.addListener("click", () => finishPolygon());
      }
      draft.markers.push(marker);
    };

    listenersRef.current.push(
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) addVertex(e.latLng);
      }),
      map.addListener("dblclick", () => finishPolygon()),
    );
  }, [clearDraft, finishPolygon, removeParcel]);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") finishPolygon();
      if (e.key === "Escape") {
        clearDraft();
        setDrawing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, finishPolygon, clearDraft]);

  const clearParcel = useCallback(() => {
    clearDraft();
    setDrawing(false);
    removeParcel();
  }, [clearDraft, removeParcel]);

  /* ---------------- SNS template (all current H/S/R configurations) ---------------- */
  const updateTemplateGeometry = useCallback((updateOutline = true, skipZoneIndex: number | null = null) => {
    const maps = mapsRef.current;
    const centre = templateCenterRef.current;
    const t = templateRef.current;
    if (!maps || !centre) return;
    const rot = rotationRef.current;
    const flip = flippedRef.current;

    const definition = definitionRef.current;
    if (updateOutline) {
      t.outline?.setPath(rectPath(maps, centre, definition.outerRect, rot, flip));
    }
    definition.zones.forEach((zone, i) => {
      if (i === skipZoneIndex) return;
      t.zones[i]?.setPath(rectPath(maps, centre, zone.rect, rot, flip));
    });
    let labelIndex = 0;
    definition.zones.forEach((zone) => {
      if (!zone.label) return;
      const c = rectCentre(zone.rect);
      t.labels[labelIndex]?.setPosition(localToLatLng(maps, centre, c.x, c.y, rot, flip));
      labelIndex += 1;
    });

    const handle = localToLatLng(maps, centre, 0, definition.rotationHandleOffset, rot, flip);
    t.rotate?.setPosition(handle);
    t.rotateHit?.setCenter(handle);
    t.move?.setPosition(centre);
    t.arm?.setPath([centre, handle]);
    evaluateTemplateFit();
    evaluateOperationalChecks();
    updateTemplateLabelsForZoom();
    scheduleAccessEvaluation();
  }, [
    evaluateOperationalChecks,
    evaluateTemplateFit,
    scheduleAccessEvaluation,
    updateTemplateLabelsForZoom,
  ]);

  const destroyTemplate = useCallback(() => {
    clearAccessOverlay();
    const t = templateRef.current;
    t.outline?.setMap(null);
    t.zones.forEach((p) => p.setMap(null));
    t.labels.forEach((m) => m.setMap(null));
    t.move?.setMap(null);
    t.rotate?.setMap(null);
    t.rotateHit?.setMap(null);
    t.arm?.setMap(null);
    templateRef.current = emptyTemplate();
    setHasTemplateControls(false);
  }, [clearAccessOverlay]);

  const placeTemplate = useCallback((preservePose = false) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const centre = preservePose ? templateCenterRef.current : map.getCenter();
    if (!centre) return;

    const definition = definitionRef.current;
    const rotation = preservePose ? rotationRef.current : 0;
    if (!preservePose) flippedRef.current = false;

    destroyTemplate();
    templateCenterRef.current = centre;
    rotationRef.current = rotation;

    const t = emptyTemplate();

    t.zones = definition.zones.map(
      (zone) =>
        new maps.Polygon({
          map,
          paths: rectPath(maps, centre, zone.rect, rotation, flippedRef.current),
          strokeColor: zone.stroke,
          strokeWeight: zone.strokeWeight,
          strokeOpacity: 0.95,
          fillColor: zone.fill,
          fillOpacity: zone.fillOpacity,
          // We handle dragging ourselves from mousedown/mousemove rather than
          // relying on Google Maps Polygon draggable. This is more reliable
          // after an automatic placement and lets the whole template move
          // when the user grabs any visible SNS zone.
          clickable: true,
          draggable: false,
          zIndex: zone.zIndex,
        }),
    );

    t.outline = new maps.Polygon({
      map,
      paths: rectPath(maps, centre, definition.outerRect, rotation, flippedRef.current),
      strokeColor: TEMPLATE_STROKE_IDLE,
      strokeWeight: 3,
      strokeOpacity: 1,
      // Secondary whole-template hit surface behind the coloured zones.
      // Manual movement is handled explicitly below, so this remains
      // clickable but is not delegated to Polygon draggable.
      fillColor: "#ffffff",
      fillOpacity: 0.025,
      clickable: true,
      draggable: false,
      zIndex: 10,
    });

    t.labels = definition.zones.filter((z) => z.label).map((zone) => {
      const c = rectCentre(zone.rect);
      return new maps.Marker({
        map,
        position: localToLatLng(maps, centre, c.x, c.y, rotation, flippedRef.current),
        clickable: false,
        zIndex: 25,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 0,
          fillOpacity: 0,
          strokeOpacity: 0,
        },
        label: {
          text: zone.label!,
          color: zone.labelColor ?? "#f8fafc",
          fontSize: zone.labelSize ?? "12px",
          fontWeight: "700",
        },
      });
    });

    // IMPORTANT: Do not create Google Maps Marker/Circle handles here.
    // Those overlays repeatedly repaint while the editable parcel and template
    // geometry update, which caused the visible MOVE / R handle flicker.
    // Manual control is now completely handle-free:
    //   MOVE mode   -> drag any coloured SNS zone
    //   ROTATE mode -> drag any coloured SNS zone around the template centre
    // The -5 / +5 degree buttons remain available for precise rotation.

    templateRef.current = t;
    setHasTemplateControls(true);
    updateTemplateLabelsForZoom();

    // Reliable manual fine-tuning after auto-fit.
    //
    // Google Maps Polygon `draggable` can be inconsistent when several
    // editable/overlapping polygons are present. Instead, begin a custom
    // drag from any template zone (or the transparent outline), track the
    // mouse in screen pixels, convert that delta back to map coordinates,
    // and translate the template centre. This works the same whether the
    // template was placed manually or by Find Best Fit / Find Max Config.
    const startTemplateDrag = (e: google.maps.MapMouseEvent) => {
      const domEvent = e.domEvent as MouseEvent;
      if (typeof domEvent.clientX !== "number" || typeof domEvent.clientY !== "number") return;

      const projection = map.getProjection();
      const startCentre = templateCenterRef.current;
      const zoom = map.getZoom();
      if (!projection || !startCentre || zoom === undefined) return;

      const startWorld = projection.fromLatLngToPoint(startCentre);
      if (!startWorld) return;

      const startX = domEvent.clientX;
      const startY = domEvent.clientY;
      const scale = 2 ** zoom;
      const parcel = polygonRef.current;
      const parcelWasEditable = parcel?.getEditable() ?? false;
      let moved = false;

      domEvent.preventDefault();
      domEvent.stopPropagation();
      parcel?.setEditable(false);
      map.setOptions({ draggable: false, draggableCursor: "grabbing" });

      const onMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;

        const nextWorld = new maps.Point(
          startWorld.x + dx / scale,
          startWorld.y + dy / scale,
        );
        const nextCentre = projection.fromPointToLatLng(nextWorld, true);
        if (!nextCentre) return;

        templateCenterRef.current = nextCentre;
        updateTemplateGeometry();
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
      };

      const finishDrag = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("mouseup", finishDrag, true);
        parcel?.setEditable(parcelWasEditable);
        map.setOptions({ draggable: true, draggableCursor: null });
        updateTemplateGeometry();

        if (moved) {
          onAutoFitMessage({
            state: "found",
            title: "Manual Position",
            detail: "Auto placement was adjusted manually. All fit checks were recalculated.",
          });
        }

        upEvent.preventDefault();
        upEvent.stopPropagation();
      };

      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", finishDrag, true);
    };

    // Interaction listeners are attached after both move and rotate handlers are defined.
    const startTemplateRotate = (e: google.maps.MapMouseEvent) => {
      const domEvent = e.domEvent as MouseEvent;
      if (typeof domEvent.clientX !== "number" || typeof domEvent.clientY !== "number") return;

      const projection = map.getProjection();
      const mapCentre = map.getCenter();
      const templateCentre = templateCenterRef.current;
      const zoom = map.getZoom();
      const mapDiv = containerRef.current;
      if (!projection || !mapCentre || !templateCentre || zoom === undefined || !mapDiv) return;

      const mapCentreWorld = projection.fromLatLngToPoint(mapCentre);
      if (!mapCentreWorld) return;

      const rect = mapDiv.getBoundingClientRect();
      const scale = 2 ** zoom;
      const parcel = polygonRef.current;
      const parcelWasEditable = parcel?.getEditable() ?? false;
      let rotated = false;

      domEvent.preventDefault();
      domEvent.stopPropagation();
      parcel?.setEditable(false);
      map.setOptions({ draggable: false, draggableCursor: "crosshair" });

      const onRotateMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - (rect.left + rect.width / 2);
        const dy = moveEvent.clientY - (rect.top + rect.height / 2);
        const pointerWorld = new maps.Point(
          mapCentreWorld.x + dx / scale,
          mapCentreWorld.y + dy / scale,
        );
        const pointerLatLng = projection.fromPointToLatLng(pointerWorld, true);
        const c = templateCenterRef.current;
        if (!pointerLatLng || !c) return;

        rotationRef.current = headingFromCentre(maps, c, pointerLatLng);
        rotated = true;
        updateTemplateGeometry();
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
      };

      const finishRotate = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", onRotateMove, true);
        window.removeEventListener("mouseup", finishRotate, true);
        parcel?.setEditable(parcelWasEditable);
        map.setOptions({ draggable: true, draggableCursor: null });
        updateTemplateGeometry();

        if (rotated) {
          onAutoFitMessage({
            state: "found",
            title: "Manual Rotation",
            detail: "Template rotation adjusted manually. All fit checks were recalculated.",
          });
        }

        upEvent.preventDefault();
        upEvent.stopPropagation();
      };

      window.addEventListener("mousemove", onRotateMove, true);
      window.addEventListener("mouseup", finishRotate, true);
    };

    const startTemplateInteraction = (e: google.maps.MapMouseEvent) => {
      if (interactionModeRef.current === "rotate") {
        startTemplateRotate(e);
      } else {
        startTemplateDrag(e);
      }
    };

    t.outline.addListener("mousedown", startTemplateInteraction);
    t.zones.forEach((zonePolygon) => {
      zonePolygon.addListener("mousedown", startTemplateInteraction);
    });

    // Every fresh/auto placement starts in MOVE mode so the user can
    // immediately fine-tune its position without hunting for a handle.
    interactionModeRef.current = "move";
    setInteractionMode("move");

    onTemplateChange(true);
    evaluateTemplateFit();
    evaluateOperationalChecks();
    updateTemplateLabelsForZoom();
    scheduleAccessEvaluation();
  }, [
    destroyTemplate,
    evaluateOperationalChecks,
    evaluateTemplateFit,
    onTemplateChange,
    scheduleAccessEvaluation,
    updateTemplateGeometry,
    updateTemplateLabelsForZoom,
  ]);


  const applyAutoPlacement = useCallback((placement: AutoPlacement) => {
    const maps = mapsRef.current;
    if (!maps) return;
    definitionRef.current = placement.definition;
    templateCenterRef.current = new maps.LatLng(placement.center);
    rotationRef.current = placement.rotation;
    flippedRef.current = placement.flipped;
    placeTemplate(true);
  }, [placeTemplate]);

  const runBestFit = useCallback(() => {
    const maps = mapsRef.current;
    const parcel = polygonRef.current;
    if (!maps || !parcel) {
      onAutoFitMessage({
        state: "not-found",
        title: "Draw Parcel First",
        detail: "Best Fit needs a measured parcel boundary.",
      });
      return;
    }

    onAutoFitMessage({
      state: "working",
      title: "Searching",
      detail: `Testing positions and rotations for ${definitionRef.current.code}...`,
    });

    window.requestAnimationFrame(() => {
      const parcelPoints = parcel.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
      const result = findBestPlacement(maps, parcelPoints, selection);
      if (!result) {
        onAutoFitMessage({
          state: "not-found",
          title: "No Fit Found",
          detail: `${definitionRef.current.code} could not be fully placed inside this parcel in the automatic search.`,
        });
        return;
      }
      applyAutoPlacement(result);
      onAutoFitMessage({
        state: "found",
        title: "Best Fit Found",
        detail: `${result.definition.code} placed at ${result.rotation.toFixed(0)} degrees with about ${result.clearanceScore.toFixed(1)} m corner clearance.`,
      });
    });
  }, [applyAutoPlacement, onAutoFitMessage, selection]);

  const runMaxConfiguration = useCallback(() => {
    const maps = mapsRef.current;
    const parcel = polygonRef.current;
    if (!maps || !parcel) {
      onAutoFitMessage({
        state: "not-found",
        title: "Draw Parcel First",
        detail: "Find Max Config needs a measured parcel boundary.",
      });
      return;
    }

    onAutoFitMessage({
      state: "working",
      title: "Testing Configurations",
      detail: "Checking S2R2, S2R1, S1R2 and S1R1 against the parcel shape.",
    });

    window.requestAnimationFrame(() => {
      const parcelPoints = parcel.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
      const result = findMaximumConfiguration(maps, parcelPoints, selection.height);
      if (!result.placement) {
        onAutoFitMessage({
          state: "not-found",
          title: "No Auto Fit Found",
          detail: "The automatic search did not find a placement for S1R1 to S2R2. You can still test manually before rejecting the parcel.",
        });
        return;
      }

      pendingAutoPlacementRef.current = result.placement;
      onAutoSelectionChange(result.placement.definition.selection);
      setAutoPlacementTick((value) => value + 1);
      onAutoFitMessage({
        state: "found",
        title: "Largest Auto Fit",
        detail: `${result.placement.definition.code} is the largest ground configuration found. H does not change the current ground footprint.`,
      });
    });
  }, [onAutoFitMessage, onAutoSelectionChange, selection.height]);

  useEffect(() => {
    if (placeNonce > 0 && status === "ready") placeTemplate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeNonce, status]);

  useEffect(() => {
    if (status !== "ready" || pendingAutoPlacementRef.current) return;
    if (!templateCenterRef.current || !templateRef.current.outline) return;
    placeTemplate(true);
  }, [selection.height, selection.parallel, selection.series, status, placeTemplate]);

  useEffect(() => {
    if (status !== "ready" || autoPlacementTick === 0) return;
    const pending = pendingAutoPlacementRef.current;
    if (!pending) return;
    pendingAutoPlacementRef.current = null;
    applyAutoPlacement({
      ...pending,
      definition: buildTemplateDefinition(selection),
    });
  }, [applyAutoPlacement, autoPlacementTick, selection, status]);

  useEffect(() => {
    if (flipNonce > 0 && templateCenterRef.current) {
      flippedRef.current = !flippedRef.current;
      updateTemplateGeometry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipNonce]);

  useEffect(() => {
    if (bestFitNonce > 0 && status === "ready") runBestFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestFitNonce]);

  useEffect(() => {
    if (maxConfigNonce > 0 && status === "ready") runMaxConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxConfigNonce]);

  /* ---------------- save / restore site state ---------------- */
  const capturePlannerSnapshot = useCallback((): PlannerMapSnapshot => {
    const map = mapRef.current;
    const parcelPath = polygonRef.current
      ? polygonRef.current.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }))
      : [];
    const templateOutline = templateRef.current.outline
      ? templateRef.current.outline.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }))
      : [];
    const templateZones = definitionRef.current.zones.map((zone, index) => ({
      key: zone.key,
      path: templateRef.current.zones[index]
        ? templateRef.current.zones[index]!.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }))
        : [],
    }));
    const mapCenter = map?.getCenter();
    const templateCenter = templateCenterRef.current;

    return {
      parcelPath,
      templatePlaced: Boolean(templateRef.current.outline && templateCenter),
      templateCenter: templateCenter ? { lat: templateCenter.lat(), lng: templateCenter.lng() } : null,
      templateRotation: rotationRef.current,
      templateFlipped: flippedRef.current,
      templateOutline,
      templateZones,
      roadEdgeIndex: roadEdgeIndexRef.current,
      gateFraction: gateFractionRef.current,
      mapCenter: mapCenter ? { lat: mapCenter.lat(), lng: mapCenter.lng() } : null,
      mapZoom: map?.getZoom() ?? 17,
      satellite,
      searchLabel: query,
    };
  }, [query, satellite]);

  useEffect(() => {
    if (snapshotRequestNonce <= 0 || status !== "ready") return;
    onSnapshotCaptured(capturePlannerSnapshot());
  }, [capturePlannerSnapshot, onSnapshotCaptured, snapshotRequestNonce, status]);

  useEffect(() => {
    if (restoreRequestNonce <= 0 || status !== "ready" || !restoreSnapshot) return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    clearDraft();
    setDrawing(false);
    cancelRoadMarking();
    cancelGateMarking();

    if (restoreSnapshot.mapCenter) map.setCenter(restoreSnapshot.mapCenter);
    map.setZoom(restoreSnapshot.mapZoom);
    setSatellite(restoreSnapshot.satellite);
    setQuery(restoreSnapshot.searchLabel);
    setSuggestions([]);

    if (restoreSnapshot.parcelPath.length >= 3) {
      setParcelPath(restoreSnapshot.parcelPath, true);
    } else {
      removeParcel();
    }

    if (restoreSnapshot.roadEdgeIndex !== null && restoreSnapshot.parcelPath.length >= 3) {
      roadEdgeIndexRef.current = restoreSnapshot.roadEdgeIndex;
      updateRoadOverlay();
      if (restoreSnapshot.gateFraction !== null) {
        gateFractionRef.current = restoreSnapshot.gateFraction;
        updateGateOverlay();
      }
    }

    if (restoreSnapshot.templatePlaced && restoreSnapshot.templateCenter) {
      definitionRef.current = buildTemplateDefinition(selection);
      templateCenterRef.current = new maps.LatLng(restoreSnapshot.templateCenter);
      rotationRef.current = restoreSnapshot.templateRotation;
      flippedRef.current = restoreSnapshot.templateFlipped;
      placeTemplate(true);
    } else {
      destroyTemplate();
      templateCenterRef.current = null;
      onTemplateChange(false);
      onTemplateFitChange("idle");
      onOperationalChecksChange(IDLE_OPERATIONAL_CHECKS);
    }

    onAutoFitMessage({
      state: "found",
      title: "Saved Site Loaded",
      detail: "Parcel, SNS placement, rotation and recorded road/gate geometry were restored.",
    });
  }, [
    cancelGateMarking,
    cancelRoadMarking,
    clearDraft,
    destroyTemplate,
    onAutoFitMessage,
    onOperationalChecksChange,
    onTemplateChange,
    onTemplateFitChange,
    placeTemplate,
    removeParcel,
    restoreRequestNonce,
    restoreSnapshot,
    selection,
    setParcelPath,
    status,
    updateGateOverlay,
    updateRoadOverlay,
  ]);

  /* ---------------- location search ---------------- */
  useEffect(() => {
    if (status !== "ready" || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: new AutocompleteSessionToken(),
        });
        if (cancelled) return;
        setSuggestions(
          results.slice(0, 6).map((s) => ({
            placeId: s.placePrediction?.placeId ?? "",
            primary: s.placePrediction?.mainText?.text ?? s.placePrediction?.text?.text ?? "",
            secondary: s.placePrediction?.secondaryText?.text ?? "",
          })),
        );
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, status]);

  const goToPlace = useCallback(async (suggestion: Suggestion) => {
    const map = mapRef.current;
    if (!map || !suggestion.placeId) return;
    setSuggestions([]);
    setQuery(suggestion.primary);
    try {
      const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
      const place = new Place({ id: suggestion.placeId });
      await place.fetchFields({ fields: ["location", "viewport"] });
      if (place.location) {
        map.setCenter(place.location);
        map.setZoom(19);
      }
    } catch {
      /* ignore lookup failures */
    }
  }, []);


  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom((map.getZoom() ?? 17) + delta);
  };

  const rotateTemplateBy = useCallback((deltaDegrees: number) => {
    if (!templateCenterRef.current || !templateRef.current.outline) return;
    rotationRef.current = (rotationRef.current + deltaDegrees + 360) % 360;
    updateTemplateGeometry();
    onAutoFitMessage({
      state: "found",
      title: "Manual Rotation",
      detail: `Template rotated ${Math.abs(deltaDegrees)} degrees ${deltaDegrees < 0 ? "counter-clockwise" : "clockwise"}.`,
    });
  }, [onAutoFitMessage, updateTemplateGeometry]);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location..."
            disabled={status !== "ready"}
            className="h-9 border-border bg-secondary/40 pl-9 text-sm"
          />
          {suggestions.length > 0 && (
            <ul className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onClick={() => void goToPlace(s)}
                    className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/60"
                  >
                    {s.primary}
                    {s.secondary && (
                      <span className="block text-xs text-muted-foreground">{s.secondary}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready"}
          onClick={() => setSatellite((s) => !s)}
        >
          {satellite ? <Satellite className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          {satellite ? "Satellite" : "Standard Map"}
        </Button>
        <Button
          variant={drawing ? "default" : "secondary"}
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready"}
          onClick={startDrawing}
        >
          <PencilRuler className="h-4 w-4" /> Draw Parcel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready" || (!hasParcel && !drawing)}
          onClick={clearParcel}
        >
          <Eraser className="h-4 w-4" /> Clear Parcel
        </Button>
        <Button
          variant={roadMode ? "default" : "secondary"}
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready" || !hasParcel || drawing}
          onClick={startRoadMarking}
        >
          <Route className="h-4 w-4" /> {roadMode ? "Select Road Edge" : hasRoad ? "Change Road" : "Mark Road"}
        </Button>
        <Button
          variant={gateMode ? "default" : "secondary"}
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready" || !hasRoad || drawing || roadMode}
          onClick={startGateMarking}
        >
          <MapPin className="h-4 w-4" /> {gateMode ? "Select Gate Point" : hasGate ? "Change Gate" : "Mark Gate"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready" || !hasParcel || drawing}
          onClick={onSaveSite}
        >
          <Save className="h-4 w-4" /> Save Site
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={status !== "ready"}
          onClick={onOpenSavedSites}
        >
          <FolderOpen className="h-4 w-4" /> Saved {savedSiteCount > 0 ? `(${savedSiteCount})` : ""}
        </Button>
      </div>

      <div className="relative min-h-[420px] flex-1 p-4">
        <div className="relative h-full min-h-[400px] overflow-hidden rounded-lg border border-border">
          <div ref={containerRef} className="absolute inset-0" />

          {status === "ready" && hasTemplateControls && (
            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1 rounded-md border border-border bg-panel/95 p-1 shadow-lg">
              <Button
                type="button"
                variant={interactionMode === "move" ? "default" : "secondary"}
                size="sm"
                className="h-8 gap-1 px-2"
                title="Move mode: drag any coloured SNS zone"
                onClick={() => chooseInteractionMode("move")}
              >
                <Move className="h-4 w-4" /> Move
              </Button>
              <Button
                type="button"
                variant={interactionMode === "rotate" ? "default" : "secondary"}
                size="sm"
                className="h-8 gap-1 px-2"
                title="Rotate mode: drag any coloured SNS zone around its centre"
                onClick={() => chooseInteractionMode("rotate")}
              >
                <RotateCw className="h-4 w-4" /> Rotate
              </Button>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1 px-2"
                title="Rotate 5 degrees counter-clockwise"
                onClick={() => rotateTemplateBy(-5)}
              >
                <RotateCcw className="h-4 w-4" /> -5°
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1 px-2"
                title="Rotate 5 degrees clockwise"
                onClick={() => rotateTemplateBy(5)}
              >
                <RotateCw className="h-4 w-4" /> +5°
              </Button>
              <span className="hidden px-1 text-[10px] font-medium text-muted-foreground lg:inline">
                Drag template to {interactionMode}
              </span>
            </div>
          )}

          {status !== "ready" && (
            <div className="grid-backdrop absolute inset-0 flex items-center justify-center px-6 text-center">
              <div>
                {status === "loading" && (
                  <>
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading satellite map...</p>
                  </>
                )}
                {status !== "loading" && (
                  <>
                    <AlertTriangle className="mx-auto h-5 w-5 text-status-warn" />
                    <h2 className="mt-3 font-display text-base font-semibold uppercase tracking-[0.18em] text-foreground">
                      {status === "unconfigured" ? "Map Not Connected" : "Map Failed To Load"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      {status === "unconfigured"
                        ? "Connect Google Maps in Lovable to enable satellite imagery and parcel drawing."
                        : errorMessage}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="absolute top-4 right-4 flex flex-col gap-1.5 rounded-md border border-border bg-card/90 p-1.5 backdrop-blur">
                {[
                  { icon: Plus, label: "Zoom in", action: () => zoomBy(1) },
                  { icon: Minus, label: "Zoom out", action: () => zoomBy(-1) },
                ].map((tool) => (
                  <Button
                    key={tool.label}
                    variant="ghost"
                    size="icon"
                    aria-label={tool.label}
                    title={tool.label}
                    onClick={tool.action}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <tool.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>

              {drawing && (
                <div
                  className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-border",
                    "bg-card/95 px-4 py-2 text-xs text-muted-foreground backdrop-blur",
                  )}
                >
                  Click the land boundary corners. Click the first point, double-click, or press
                  Enter to close the parcel.
                </div>
              )}
              {roadMode && (
                <div
                  className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-status-warn/50",
                    "bg-card/95 px-4 py-2 text-xs text-status-warn backdrop-blur",
                  )}
                >
                  Click the parcel edge that faces the road. Press Escape to cancel.
                </div>
              )}
              {gateMode && (
                <div
                  className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-yellow-400/50",
                    "bg-card/95 px-4 py-2 text-xs text-yellow-300 backdrop-blur",
                  )}
                >
                  Click near the orange road edge to place the gate. Drag the yellow marker to adjust it.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
