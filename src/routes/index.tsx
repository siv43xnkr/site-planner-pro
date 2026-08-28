import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfigSidebar } from "@/components/dashboard/ConfigSidebar";
import { MapWorkspace } from "@/components/dashboard/MapWorkspace";
import { SuitabilitySidebar } from "@/components/dashboard/SuitabilitySidebar";
import { SavedSitesDialog } from "@/components/dashboard/SavedSitesDialog";
import type {
  AccessType,
  AutoFitMessage,
  GateInfo,
  OperationalChecks,
  RoadInfo,
  TemplateFitState,
  TemplateSelection,
} from "@/lib/site-types";
import { IDLE_OPERATIONAL_CHECKS } from "@/lib/site-types";
import {
  downloadSavedSitesBackup,
  loadSavedSites,
  makeSavedSiteId,
  openSiteReport,
  persistSavedSites,
  type PlannerMapSnapshot,
  type SavedSite,
} from "@/lib/saved-sites";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stack n Stock Site Suitability Dashboard" },
      {
        name: "description",
        content:
          "Plan ASRS pod sites: test Stack n Stock template configurations against land parcels for fit, circulation and access.",
      },
      { property: "og:title", content: "Stack n Stock Site Suitability Dashboard" },
      {
        property: "og:description",
        content:
          "Site-planning dashboard for testing Stack n Stock ASRS pod configurations against land parcels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [selection, setSelection] = useState<TemplateSelection>({
    height: "H1",
    series: "S1",
    parallel: "R1",
  });
  const [parcelArea, setParcelArea] = useState<number | null>(null);
  const [placeNonce, setPlaceNonce] = useState(0);
  const [flipNonce, setFlipNonce] = useState(0);
  const [bestFitNonce, setBestFitNonce] = useState(0);
  const [maxConfigNonce, setMaxConfigNonce] = useState(0);
  const [templatePlaced, setTemplatePlaced] = useState(false);
  const [templateFit, setTemplateFit] = useState<TemplateFitState>("idle");
  const [operationalChecks, setOperationalChecks] = useState<OperationalChecks>(
    IDLE_OPERATIONAL_CHECKS,
  );
  const [roadInfo, setRoadInfo] = useState<RoadInfo | null>(null);
  const [gateInfo, setGateInfo] = useState<GateInfo | null>(null);
  const [roadWidthMeters, setRoadWidthMeters] = useState<number | null>(null);
  const [gateWidthMeters, setGateWidthMeters] = useState<number | null>(null);
  const [accessType, setAccessType] = useState<AccessType>("single-in-out");
  const [autoFitMessage, setAutoFitMessage] = useState<AutoFitMessage>({
    state: "idle",
    title: "Auto Fit Ready",
    detail: "Draw a parcel to use automatic placement.",
  });
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [savedSitesDialogMode, setSavedSitesDialogMode] = useState<"save" | "manage" | null>(null);
  const [snapshotRequestNonce, setSnapshotRequestNonce] = useState(0);
  const [restoreRequestNonce, setRestoreRequestNonce] = useState(0);
  const [restoreSnapshot, setRestoreSnapshot] = useState<PlannerMapSnapshot | null>(null);
  const pendingSaveRef = useRef<{ name: string; notes: string } | null>(null);

  useEffect(() => {
    setSavedSites(loadSavedSites());
  }, []);

  const requestSaveSite = useCallback((name: string, notes: string) => {
    pendingSaveRef.current = { name, notes };
    setSavedSitesDialogMode(null);
    setSnapshotRequestNonce((value) => value + 1);
  }, []);

  const handleSnapshotCaptured = useCallback((snapshot: PlannerMapSnapshot) => {
    const pending = pendingSaveRef.current;
    if (!pending || parcelArea === null) return;
    pendingSaveRef.current = null;
    const now = new Date().toISOString();
    const site: SavedSite = {
      id: makeSavedSiteId(),
      name: pending.name,
      notes: pending.notes,
      createdAt: now,
      updatedAt: now,
      selection,
      parcelAreaM2: parcelArea,
      templateFit,
      operationalChecks,
      roadInfo,
      roadWidthMeters,
      gateWidthMeters,
      accessType,
      autoFitMessage,
      map: snapshot,
    };
    setSavedSites((current) => {
      const next = [site, ...current];
      persistSavedSites(next);
      return next;
    });
    setSavedSitesDialogMode("manage");
  }, [
    accessType,
    autoFitMessage,
    gateWidthMeters,
    operationalChecks,
    parcelArea,
    roadInfo,
    roadWidthMeters,
    selection,
    templateFit,
  ]);

  const loadSavedSite = useCallback((site: SavedSite) => {
    setSelection(site.selection);
    setRoadWidthMeters(site.roadWidthMeters);
    setGateWidthMeters(site.gateWidthMeters);
    setAccessType(site.accessType);
    setRestoreSnapshot(site.map);
    setRestoreRequestNonce((value) => value + 1);
    setSavedSitesDialogMode(null);
  }, []);

  const deleteSavedSite = useCallback((site: SavedSite) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete saved site "${site.name}"?`)) return;
    setSavedSites((current) => {
      const next = current.filter((item) => item.id !== site.id);
      persistSavedSites(next);
      return next;
    });
  }, []);

  return (
    <>
    <main className="flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <ConfigSidebar
        selection={selection}
        onSelectionChange={setSelection}
        onPlaceTemplate={() => setPlaceNonce((value) => value + 1)}
        onFlipLayout={() => setFlipNonce((value) => value + 1)}
        onFindBestFit={() => setBestFitNonce((value) => value + 1)}
        onFindMaxConfiguration={() => setMaxConfigNonce((value) => value + 1)}
      />
      <MapWorkspace
        selection={selection}
        onAutoSelectionChange={setSelection}
        onAreaChange={setParcelArea}
        placeNonce={placeNonce}
        flipNonce={flipNonce}
        bestFitNonce={bestFitNonce}
        maxConfigNonce={maxConfigNonce}
        onTemplateChange={setTemplatePlaced}
        onTemplateFitChange={setTemplateFit}
        onOperationalChecksChange={setOperationalChecks}
        onRoadChange={setRoadInfo}
        gateWidthMeters={gateWidthMeters}
        roadWidthMeters={roadWidthMeters}
        accessType={accessType}
        onGateChange={setGateInfo}
        onBadaDostScreenChange={() => undefined}
        onAutoFitMessage={setAutoFitMessage}
        snapshotRequestNonce={snapshotRequestNonce}
        restoreRequestNonce={restoreRequestNonce}
        restoreSnapshot={restoreSnapshot}
        onSnapshotCaptured={handleSnapshotCaptured}
        savedSiteCount={savedSites.length}
        onSaveSite={() => setSavedSitesDialogMode("save")}
        onOpenSavedSites={() => setSavedSitesDialogMode("manage")}
      />
      <SuitabilitySidebar
        selection={selection}
        parcelArea={parcelArea}
        templatePlaced={templatePlaced}
        templateFit={templateFit}
        operationalChecks={operationalChecks}
        roadInfo={roadInfo}
        gateInfo={gateInfo}
        roadWidthMeters={roadWidthMeters}
        gateWidthMeters={gateWidthMeters}
        accessType={accessType}
        autoFitMessage={autoFitMessage}
        onRoadWidthChange={setRoadWidthMeters}
        onGateWidthChange={setGateWidthMeters}
        onAccessTypeChange={setAccessType}
      />
    </main>
      <SavedSitesDialog
        open={savedSitesDialogMode !== null}
        mode={savedSitesDialogMode ?? "manage"}
        selection={selection}
        sites={savedSites}
        onClose={() => setSavedSitesDialogMode(null)}
        onCreate={requestSaveSite}
        onLoad={loadSavedSite}
        onDelete={deleteSavedSite}
        onReport={openSiteReport}
        onBackup={() => downloadSavedSitesBackup(savedSites)}
      />
    </>
  );
}
