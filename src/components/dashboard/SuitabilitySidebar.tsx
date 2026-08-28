import { formatArea } from "@/lib/google-maps";
import { buildTemplateDefinition } from "@/lib/sns-template";
import type {
  AccessType,
  AutoFitMessage,
  GateInfo,
  OperationalChecks,
  RoadInfo,
  TemplateFitState,
  TemplateSelection,
  ZoneCheckState,
} from "@/lib/site-types";

type VisualState = "idle" | "pending" | "pass" | "warn" | "fail";

type SuitabilitySidebarProps = {
  selection: TemplateSelection;
  parcelArea: number | null;
  templatePlaced: boolean;
  templateFit: TemplateFitState;
  operationalChecks: OperationalChecks;
  roadInfo: RoadInfo | null;
  gateInfo: GateInfo | null;
  roadWidthMeters: number | null;
  gateWidthMeters: number | null;
  accessType: AccessType;
  autoFitMessage: AutoFitMessage;
  onRoadWidthChange: (value: number | null) => void;
  onGateWidthChange: (value: number | null) => void;
  onAccessTypeChange: (value: AccessType) => void;
};

function StatusPill({ label, state = "idle" }: { label: string; state?: VisualState }) {
  const dot = {
    idle: "bg-status-idle",
    pending: "bg-primary",
    pass: "bg-status-pass",
    warn: "bg-status-warn",
    fail: "bg-status-fail",
  }[state];
  const text = {
    idle: "text-muted-foreground",
    pending: "text-primary",
    pass: "text-status-pass",
    warn: "text-status-warn",
    fail: "text-status-fail",
  }[state];

  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 py-0.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={`font-display text-[11px] font-semibold uppercase tracking-wider ${text}`}>{label}</span>
    </span>
  );
}

function numberFromInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function zoneVisual(state: ZoneCheckState): VisualState {
  if (state === "pass") return "pass";
  if (state === "fail") return "fail";
  return "idle";
}

function zoneLabel(state: ZoneCheckState): string {
  if (state === "pass") return "Fits Parcel";
  if (state === "fail") return "Outside Parcel";
  return "Not Evaluated";
}

function messageVisual(state: AutoFitMessage["state"]): VisualState {
  if (state === "working") return "pending";
  if (state === "found") return "pass";
  if (state === "not-found") return "warn";
  return "idle";
}

export function SuitabilitySidebar({
  selection,
  parcelArea,
  templatePlaced,
  templateFit,
  operationalChecks,
  roadInfo,
  gateInfo,
  roadWidthMeters,
  gateWidthMeters,
  accessType,
  autoFitMessage,
  onRoadWidthChange,
  onGateWidthChange,
  onAccessTypeChange,
}: SuitabilitySidebarProps) {
  const definition = buildTemplateDefinition(selection);
  const measured = parcelArea !== null && parcelArea > 0;
  const area = measured ? formatArea(parcelArea) : null;
  const roadMarked = roadInfo !== null;
  const gateMarked = gateInfo !== null;
  const dimensionsKnown = roadWidthMeters !== null && gateWidthMeters !== null;
  const roadLength = roadInfo ? roadInfo.lengthMeters.toFixed(1) : null;

  let physicalLabel = "Not Evaluated";
  let physicalState: VisualState = "idle";
  if (templatePlaced) {
    if (!measured || templateFit === "idle") {
      physicalLabel = "Pending Evaluation";
      physicalState = "pending";
    } else if (templateFit === "pass") {
      physicalLabel = "Fits Parcel";
      physicalState = "pass";
    } else {
      physicalLabel = "Outside Parcel";
      physicalState = "fail";
    }
  }

  let roadGateLabel = "Not Evaluated";
  let roadGateState: VisualState = "idle";
  if (gateMarked && dimensionsKnown) {
    roadGateLabel = "Inputs Recorded";
    roadGateState = "pending";
  } else if (gateMarked) {
    roadGateLabel = "Gate Marked";
    roadGateState = "warn";
  } else if (roadMarked) {
    roadGateLabel = "Road Side Marked";
    roadGateState = "warn";
  }

  const allOpsPass = Object.values(operationalChecks).every((state) => state === "pass");
  const anyOpsFail = Object.values(operationalChecks).some((state) => state === "fail");

  let overallTitle = "Waiting for Site Input";
  let overallText = "Search a location, draw the land parcel, then place an SNS template or run Find Max Config.";
  let overallClass = "text-status-idle";

  if (templatePlaced && (templateFit === "fail" || anyOpsFail)) {
    overallTitle = "Not Suitable - Geometry";
    overallText = `${definition.code} is not fully contained within the parcel. Move, rotate, flip, or run Find Best Fit.`;
    overallClass = "text-status-fail";
  } else if (templatePlaced && templateFit === "pass" && allOpsPass && gateMarked && dimensionsKnown) {
    overallTitle = "Conditional - Geometry Passed";
    overallText = `${definition.code} and all current operating zones fit. Road/gate inputs are recorded; final legal, survey and vehicle checks remain separate.`;
    overallClass = "text-status-warn";
  } else if (templatePlaced && templateFit === "pass" && allOpsPass) {
    overallTitle = "Conditional - Physical Fit";
    overallText = "All current SNS geometry checks pass. Mark the road/gate when known and verify the parcel by survey before deployment.";
    overallClass = "text-status-warn";
  } else if (measured && !templatePlaced) {
    overallTitle = "Waiting for SNS Template";
    overallText = "Land parcel measured. Select a configuration or use Find Max Config.";
  } else if (templatePlaced) {
    overallTitle = "SNS Template Placed";
    overallText = "Position, rotate or flip the SNS template inside the measured parcel.";
    overallClass = "text-primary";
  }

  const opRows: Array<[string, ZoneCheckState]> = [
    ["Bike Circulation", operationalChecks.bikeCirculation],
    ["Utility Area X", operationalChecks.utilityX],
    ["Generator Placement", operationalChecks.generator],
    ["B Operational Area", operationalChecks.bOperational],
  ];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-l border-border bg-panel lg:w-[370px]">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">Site Suitability</h2>
        <p className="label-caps mt-1">Evaluation Checklist - {definition.code}</p>
      </header>

      <ul className="divide-y divide-border">
        <li className="px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Parcel Area</span>
            <StatusPill label={measured ? "Measured" : "Not Evaluated"} state={measured ? "pass" : "idle"} />
          </div>
          {area && (
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-display text-xl font-bold text-foreground">{area.sqm} m2</span>
              <span className="font-display text-sm font-semibold text-muted-foreground">{area.cents} cents</span>
            </div>
          )}
        </li>

        <li className="flex items-center justify-between gap-3 px-5 py-3">
          <span className="text-sm text-foreground">Physical Template Fit</span>
          <StatusPill label={physicalLabel} state={physicalState} />
        </li>

        {opRows.map(([label, state]) => (
          <li key={label} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-foreground">{label}</span>
            <StatusPill label={zoneLabel(state)} state={zoneVisual(state)} />
          </li>
        ))}

        <li className="px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Auto Placement</span>
            <StatusPill label={autoFitMessage.title} state={messageVisual(autoFitMessage.state)} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{autoFitMessage.detail}</p>
        </li>

        <li className="px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Road / Gate Verification</span>
            <StatusPill label={roadGateLabel} state={roadGateState} />
          </div>
          {roadMarked && roadLength && (
            <div className="mt-2 text-xs text-muted-foreground">
              Road-facing parcel edge: <span className="font-mono text-foreground">{roadLength} m</span>.
            </div>
          )}
          {gateMarked && <div className="mt-1 text-xs text-muted-foreground">Gate/access point mapped on the selected road edge.</div>}

          {roadMarked && (
            <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/20 p-3">
              <label className="block text-xs text-muted-foreground">
                Site access type
                <select
                  value={accessType}
                  onChange={(event) => onAccessTypeChange(event.target.value as AccessType)}
                  className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="single-in-out">Single front access - same IN / OUT</option>
                  <option value="front-entry-side-exit">Front entry + side-road exit</option>
                  <option value="truck-drive-through">Drive-through site</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Road width (m)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={roadWidthMeters ?? ""}
                    placeholder="Unknown"
                    onChange={(event) => onRoadWidthChange(numberFromInput(event.target.value))}
                    className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Gate width (m)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={gateWidthMeters ?? ""}
                    placeholder="Unknown"
                    onChange={(event) => onGateWidthChange(numberFromInput(event.target.value))}
                    className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Road and gate values are documentation inputs only. Vehicle swept-path analysis is intentionally not part of this version.
              </p>
            </div>
          )}
        </li>
      </ul>

      <div className="mt-auto p-5">
        <div className="rounded-lg border border-border bg-card p-5 text-center">
          <h3 className="label-caps">Overall Result</h3>
          <p className={`mt-3 font-display text-xl font-bold uppercase tracking-wider ${overallClass}`}>{overallTitle}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{overallText}</p>
        </div>
      </div>
    </aside>
  );
}
