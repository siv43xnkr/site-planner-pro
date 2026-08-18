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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";
import {
  OUTER_RECT,
  ROTATION_HANDLE_OFFSET,
  ZONES,
  headingFromCentre,
  localToLatLng,
  rectCentre,
  rectPath,
} from "@/lib/sns-template";

const PARCEL_STROKE = "#22d3ee";
const TEMPLATE_STROKE = "#f8fafc";
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

type Suggestion = { placeId: string; primary: string; secondary: string };

type TemplateObjects = {
  outline: google.maps.Polygon | null;
  zones: google.maps.Polygon[];
  labels: google.maps.Marker[];
  move: google.maps.Marker | null;
  rotate: google.maps.Marker | null;
  arm: google.maps.Polyline | null;
};

const emptyTemplate = (): TemplateObjects => ({
  outline: null,
  zones: [],
  labels: [],
  move: null,
  rotate: null,
  arm: null,
});

export function MapWorkspace({
  onAreaChange,
  placeNonce,
  flipNonce,
  onTemplateChange,
}: {
  onAreaChange: (area: number | null) => void;
  placeNonce: number;
  flipNonce: number;
  onTemplateChange: (placed: boolean) => void;
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
  const templateRef = useRef<TemplateObjects>(emptyTemplate());
  const templateCenterRef = useRef<google.maps.LatLng | null>(null);
  const rotationRef = useRef(0);
  const flippedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unconfigured">(
    hasGoogleMapsKey ? "loading" : "unconfigured",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [satellite, setSatellite] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [hasParcel, setHasParcel] = useState(false);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);


  /* ---------------- map init ---------------- */
  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let cancelled = false;
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
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMessage(err.message || "Google Maps could not be loaded.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setMapTypeId(satellite ? "satellite" : "roadmap");
  }, [satellite]);

  /* ---------------- area ---------------- */
  const recalcArea = useCallback(() => {
    const maps = mapsRef.current;
    const polygon = polygonRef.current;
    if (!maps || !polygon) return;
    onAreaChange(maps.geometry.spherical.computeArea(polygon.getPath()));
  }, [onAreaChange]);

  /* ---------------- draft helpers ---------------- */
  const clearDraft = useCallback(() => {
    draftRef.current.line?.setMap(null);
    draftRef.current.markers.forEach((m) => m.setMap(null));
    draftRef.current = { path: [], line: null, markers: [] };
    listenersRef.current.forEach((l) => l.remove());
    listenersRef.current = [];
  }, []);

  const removeParcel = useCallback(() => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setHasParcel(false);
    onAreaChange(null);
  }, [onAreaChange]);

  const finishPolygon = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const path = draftRef.current.path;
    if (!maps || !map || path.length < 3) return;

    polygonRef.current?.setMap(null);
    const polygon = new maps.Polygon({
      paths: path,
      map,
      strokeColor: PARCEL_STROKE,
      strokeWeight: 2.5,
      strokeOpacity: 1,
      fillColor: PARCEL_STROKE,
      fillOpacity: 0.12,
      editable: true,
      draggable: false,
      zIndex: 5,
    });
    polygonRef.current = polygon;

    const p = polygon.getPath();
    ["set_at", "insert_at", "remove_at"].forEach((evt) =>
      maps.event.addListener(p, evt, () => recalcArea()),
    );

    clearDraft();
    setDrawing(false);
    setHasParcel(true);
    recalcArea();
  }, [clearDraft, recalcArea]);

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

      // Closing the shape by clicking near the first vertex.
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
        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
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

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location…"
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
        <Button variant="secondary" size="sm" className="gap-1.5" disabled>
          <Route className="h-4 w-4" /> Mark Road
        </Button>
      </div>

      <div className="relative min-h-[420px] flex-1 p-4">
        <div className="relative h-full min-h-[400px] overflow-hidden rounded-lg border border-border">
          <div ref={containerRef} className="absolute inset-0" />

          {status !== "ready" && (
            <div className="grid-backdrop absolute inset-0 flex items-center justify-center px-6 text-center">
              <div>
                {status === "loading" && (
                  <>
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading satellite map…</p>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
