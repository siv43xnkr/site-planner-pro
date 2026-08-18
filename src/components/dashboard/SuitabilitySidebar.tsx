import { formatArea } from "@/lib/google-maps";

const OTHER_CHECKS = [
  "Physical Template Fit",
  "Bike Circulation",
  "Utility Area X",
  "Generator Placement",
  "B Operational Area",
  "Bada Dost Access",
  "Road / Gate Verification",
];

export function SuitabilitySidebar({ parcelArea }: { parcelArea: number | null }) {
  const measured = parcelArea !== null && parcelArea > 0;
  const area = measured ? formatArea(parcelArea) : null;

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-l border-border bg-panel lg:w-[320px]">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
          Site Suitability
        </h2>
        <p className="label-caps mt-1">Evaluation Checklist</p>
      </header>

      <ul className="divide-y divide-border">
        <li className="px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Parcel Area</span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 py-0.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${measured ? "bg-status-pass" : "bg-status-idle"}`}
              />
              <span
                className={`font-display text-[11px] font-semibold uppercase tracking-wider ${
                  measured ? "text-status-pass" : "text-muted-foreground"
                }`}
              >
                {measured ? "Measured" : "Not Evaluated"}
              </span>
            </span>
          </div>
          {area && (
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-display text-xl font-bold text-foreground">
                {area.sqm} m²
              </span>
              <span className="font-display text-sm font-semibold text-muted-foreground">
                {area.cents} cents
              </span>
            </div>
          )}
        </li>

        {OTHER_CHECKS.map((check) => (
          <li key={check} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-foreground">{check}</span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-idle" />
              <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Not Evaluated
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto p-5">
        <div className="rounded-lg border border-border bg-card p-5 text-center">
          <h3 className="label-caps">Overall Result</h3>
          <p className="mt-3 font-display text-xl font-bold uppercase tracking-wider text-status-idle">
            {measured ? "Waiting for SNS Template" : "Waiting for Site Input"}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {measured
              ? "Land parcel measured. Place an SNS template to begin suitability evaluation."
              : "Draw a land parcel and place an SNS template to begin evaluation."}
          </p>
        </div>
      </div>
    </aside>
  );
}
