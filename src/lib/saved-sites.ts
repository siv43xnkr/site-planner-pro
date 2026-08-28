import type {
  AccessType,
  AutoFitMessage,
  OperationalChecks,
  RoadInfo,
  TemplateFitState,
  TemplateSelection,
} from "@/lib/site-types";

export type LatLngPoint = { lat: number; lng: number };

export type PlannerMapSnapshot = {
  parcelPath: LatLngPoint[];
  templatePlaced: boolean;
  templateCenter: LatLngPoint | null;
  templateRotation: number;
  templateFlipped: boolean;
  templateOutline: LatLngPoint[];
  templateZones: Array<{ key: string; path: LatLngPoint[] }>;
  roadEdgeIndex: number | null;
  gateFraction: number | null;
  mapCenter: LatLngPoint | null;
  mapZoom: number;
  satellite: boolean;
  searchLabel: string;
};

export type SavedSite = {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  selection: TemplateSelection;
  parcelAreaM2: number;
  templateFit: TemplateFitState;
  operationalChecks: OperationalChecks;
  roadInfo: RoadInfo | null;
  roadWidthMeters: number | null;
  gateWidthMeters: number | null;
  accessType: AccessType;
  autoFitMessage: AutoFitMessage;
  map: PlannerMapSnapshot;
};

const STORAGE_KEY = "sns-site-planner-saved-sites-v1";
const SQM_PER_CENT = 40.4686;

const isBrowser = () => typeof window !== "undefined";

export function loadSavedSites(): SavedSite[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedSite[];
  } catch {
    return [];
  }
}

export function persistSavedSites(sites: SavedSite[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  } catch {
    // Browser storage can be unavailable in private/restricted modes.
  }
}

export function makeSavedSiteId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sns-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function downloadSavedSitesBackup(sites: SavedSite[]) {
  if (!isBrowser()) return;
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sites }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sns-site-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stateLabel(state: TemplateFitState) {
  if (state === "pass") return "PASS";
  if (state === "fail") return "FAIL";
  return "NOT EVALUATED";
}

function checkLabel(state: OperationalChecks[keyof OperationalChecks]) {
  if (state === "pass") return "PASS";
  if (state === "fail") return "FAIL";
  return "NOT EVALUATED";
}

function accessTypeLabel(accessType: AccessType) {
  switch (accessType) {
    case "front-entry-side-exit":
      return "Front entry + side-road exit";
    case "truck-drive-through":
      return "Truck drive-through site";
    default:
      return "Single front access - same IN / OUT";
  }
}

function selectionLabel(selection: TemplateSelection) {
  return `${selection.height} ${selection.series} ${selection.parallel}`;
}

function polygonSvg(site: SavedSite) {
  const parcel = site.map.parcelPath;
  if (parcel.length < 3) {
    return `<div class="empty-plan">No parcel geometry saved.</div>`;
  }

  const allPaths = [
    parcel,
    site.map.templateOutline,
    ...site.map.templateZones.map((zone) => zone.path),
  ].filter((path) => path.length > 0);
  const all = allPaths.flat();
  const refLat = all.reduce((sum, point) => sum + point.lat, 0) / all.length;
  const refLng = all.reduce((sum, point) => sum + point.lng, 0) / all.length;
  const cosLat = Math.cos((refLat * Math.PI) / 180);

  const xy = (point: LatLngPoint) => ({
    x: (point.lng - refLng) * 111_320 * cosLat,
    y: -(point.lat - refLat) * 110_540,
  });

  const projected = all.map(xy);
  let minX = Math.min(...projected.map((p) => p.x));
  let maxX = Math.max(...projected.map((p) => p.x));
  let minY = Math.min(...projected.map((p) => p.y));
  let maxY = Math.max(...projected.map((p) => p.y));
  const widthM = Math.max(maxX - minX, 1);
  const heightM = Math.max(maxY - minY, 1);
  const pad = Math.max(widthM, heightM) * 0.08 + 1;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const width = 820;
  const height = 440;
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const toSvg = (point: LatLngPoint) => {
    const p = xy(point);
    return {
      x: offsetX + (p.x - minX) * scale,
      y: offsetY + (p.y - minY) * scale,
    };
  };
  const points = (path: LatLngPoint[]) =>
    path.map((point) => {
      const p = toSvg(point);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");

  const zoneStyle: Record<string, { fill: string; stroke: string }> = {
    A: { fill: "rgba(168,85,247,.18)", stroke: "#a855f7" },
    B: { fill: "rgba(34,197,94,.18)", stroke: "#22c55e" },
    b: { fill: "rgba(250,204,21,.16)", stroke: "#eab308" },
    "rear-bike": { fill: "rgba(14,165,233,.16)", stroke: "#0ea5e9" },
    X: { fill: "rgba(239,68,68,.12)", stroke: "#ef4444" },
    generator: { fill: "rgba(148,163,184,.2)", stroke: "#94a3b8" },
  };

  const zones = site.map.templateZones.map((zone) => {
    const style = zoneStyle[zone.key] ?? { fill: "rgba(255,255,255,.08)", stroke: "#cbd5e1" };
    return `<polygon points="${points(zone.path)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2" />`;
  }).join("");

  let road = "";
  if (site.map.roadEdgeIndex !== null && parcel.length >= 2) {
    const i = site.map.roadEdgeIndex;
    const start = parcel[i];
    const end = parcel[(i + 1) % parcel.length];
    if (start && end) {
      const a = toSvg(start);
      const b = toSvg(end);
      road = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" />`;
      if (site.map.gateFraction !== null) {
        const f = site.map.gateFraction;
        const gx = a.x + (b.x - a.x) * f;
        const gy = a.y + (b.y - a.y) * f;
        road += `<circle cx="${gx}" cy="${gy}" r="7" fill="#facc15" stroke="#111827" stroke-width="2" />`;
      }
    }
  }

  const outline = site.map.templateOutline.length >= 3
    ? `<polygon points="${points(site.map.templateOutline)}" fill="none" stroke="${site.templateFit === "fail" ? "#ef4444" : "#22c55e"}" stroke-width="3" />`
    : "";

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved parcel and SNS template plan">
      <rect width="${width}" height="${height}" rx="12" fill="#0b1220" />
      <polygon points="${points(parcel)}" fill="rgba(34,211,238,.08)" stroke="#22d3ee" stroke-width="3" />
      ${zones}
      ${outline}
      ${road}
    </svg>`;
}

export function buildSiteReportHtml(site: SavedSite) {
  const cents = site.parcelAreaM2 / SQM_PER_CENT;
  const roadLength = site.roadInfo?.lengthMeters ?? null;
  const centre = site.map.templateCenter;
  const savedAt = new Date(site.updatedAt).toLocaleString();
  const overallPhysical = site.templateFit === "pass" &&
    Object.values(site.operationalChecks).every((state) => state === "pass");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(site.name)} - Stack n Stock Site Report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, Arial, sans-serif; color: #111827; background: #f3f4f6; }
  .page { max-width: 1050px; margin: 24px auto; background: white; padding: 32px; box-shadow: 0 10px 35px rgba(0,0,0,.08); }
  .brand { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; border-bottom:3px solid #facc15; padding-bottom:18px; }
  .brand h1 { margin:0; font-size:26px; letter-spacing:.04em; }
  .brand p { margin:6px 0 0; color:#6b7280; }
  .badge { padding:8px 12px; border-radius:999px; font-weight:800; font-size:12px; background:${overallPhysical ? "#dcfce7" : "#fef3c7"}; color:${overallPhysical ? "#166534" : "#92400e"}; }
  .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:22px 0; }
  .card { border:1px solid #e5e7eb; border-radius:12px; padding:14px; }
  .label { color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
  .value { margin-top:5px; font-size:18px; font-weight:800; }
  h2 { margin:28px 0 12px; font-size:17px; }
  table { width:100%; border-collapse:collapse; }
  th,td { padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:left; font-size:13px; }
  th { color:#6b7280; font-weight:600; width:42%; }
  .plan { border:1px solid #d1d5db; border-radius:14px; padding:12px; overflow:hidden; background:#0b1220; }
  .plan svg { width:100%; height:auto; display:block; }
  .note { margin-top:18px; padding:12px 14px; background:#f9fafb; border-left:4px solid #facc15; font-size:12px; color:#4b5563; line-height:1.55; }
  .actions { position:sticky; top:0; display:flex; justify-content:flex-end; gap:8px; padding-bottom:10px; background:white; }
  button { border:0; border-radius:8px; padding:10px 14px; font-weight:700; cursor:pointer; background:#111827; color:white; }
  @media print { body { background:white; } .page { box-shadow:none; margin:0; max-width:none; padding:14mm; } .actions { display:none; } }
  @media (max-width:760px) { .grid { grid-template-columns:1fr; } .brand { flex-direction:column; } }
</style>
</head>
<body>
<div class="page">
  <div class="actions"><button onclick="window.print()">Print / Save PDF</button></div>
  <div class="brand">
    <div><h1>STACK N STOCK</h1><p>Site Suitability Report - ${escapeHtml(site.name)}</p></div>
    <div class="badge">${overallPhysical ? "PHYSICAL GEOMETRY PASS" : "REQUIRES REVIEW"}</div>
  </div>
  <div class="grid">
    <div class="card"><div class="label">Configuration</div><div class="value">${escapeHtml(selectionLabel(site.selection))}</div></div>
    <div class="card"><div class="label">Parcel Area</div><div class="value">${site.parcelAreaM2.toFixed(1)} m²</div></div>
    <div class="card"><div class="label">Approx. Land</div><div class="value">${cents.toFixed(2)} cents</div></div>
  </div>
  <h2>Saved Site Plan</h2>
  <div class="plan">${polygonSvg(site)}</div>
  <h2>Evaluation</h2>
  <table>
    <tr><th>Physical Template Fit</th><td>${stateLabel(site.templateFit)}</td></tr>
    <tr><th>Bike Circulation</th><td>${checkLabel(site.operationalChecks.bikeCirculation)}</td></tr>
    <tr><th>Utility Area X</th><td>${checkLabel(site.operationalChecks.utilityX)}</td></tr>
    <tr><th>Generator Placement</th><td>${checkLabel(site.operationalChecks.generator)}</td></tr>
    <tr><th>B Operational Area</th><td>${checkLabel(site.operationalChecks.bOperational)}</td></tr>
    <tr><th>Auto / Manual Placement Status</th><td>${escapeHtml(site.autoFitMessage.title)}</td></tr>
  </table>
  <h2>Placement & Access Record</h2>
  <table>
    <tr><th>Template Rotation</th><td>${site.map.templateRotation.toFixed(1)}°</td></tr>
    <tr><th>Layout</th><td>${site.map.templateFlipped ? "Flipped (B | A | b)" : "Normal (b | A | B)"}</td></tr>
    <tr><th>Template Centre</th><td>${centre ? `${centre.lat.toFixed(6)}, ${centre.lng.toFixed(6)}` : "Not placed"}</td></tr>
    <tr><th>Road-facing Edge</th><td>${roadLength === null ? "Not marked" : `${roadLength.toFixed(1)} m`}</td></tr>
    <tr><th>Road Width</th><td>${site.roadWidthMeters === null ? "Unknown" : `${site.roadWidthMeters.toFixed(2)} m`}</td></tr>
    <tr><th>Gate Width</th><td>${site.gateWidthMeters === null ? "Unknown" : `${site.gateWidthMeters.toFixed(2)} m`}</td></tr>
    <tr><th>Access Type</th><td>${escapeHtml(accessTypeLabel(site.accessType))}</td></tr>
    <tr><th>Map Search / Locality</th><td>${escapeHtml(site.map.searchLabel || "Not recorded")}</td></tr>
    <tr><th>Saved / Updated</th><td>${escapeHtml(savedAt)}</td></tr>
  </table>
  ${site.notes ? `<h2>Notes</h2><div class="card">${escapeHtml(site.notes).replaceAll("\n", "<br/>")}</div>` : ""}
  <div class="note"><strong>Screening report:</strong> Parcel geometry traced from map imagery is an estimate, not a legal cadastral or survey boundary. Confirm dimensions, title/statutory conditions, access and construction/deployment requirements using survey and engineering data before committing to a site.</div>
</div>
</body>
</html>`;
}

export function openSiteReport(site: SavedSite) {
  if (!isBrowser()) return;
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return;
  try {
    reportWindow.opener = null;
  } catch {
    // Ignore browsers that expose opener as read-only.
  }
  reportWindow.document.open();
  reportWindow.document.write(buildSiteReportHtml(site));
  reportWindow.document.close();
}
