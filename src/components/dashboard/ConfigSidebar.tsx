import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildTemplateDefinition } from "@/lib/sns-template";
import type {
  HeightCode,
  ParallelCode,
  SeriesCode,
  TemplateSelection,
} from "@/lib/site-types";

const GROUPS = [
  { key: "height", label: "Height", options: ["H1", "H2", "H3"] as HeightCode[] },
  { key: "series", label: "Series", options: ["S1", "S2"] as SeriesCode[] },
  { key: "parallel", label: "Parallel", options: ["R1", "R2"] as ParallelCode[] },
] as const;

const ZONES = [
  { tag: "b", title: "Bike Dispatch Side", detail: "2.50 m", color: "bg-primary" },
  { tag: "A", title: "Pod / Container", detail: "12.192 m per series + E 2.50 / 1.50", color: "bg-status-pass" },
  { tag: "B", title: "Main Operations", detail: "5.00 m", color: "bg-status-warn" },
  { tag: "", title: "Rear Bike Connection", detail: "1.80 m", color: "bg-muted-foreground" },
  { tag: "X", title: "Utility Area", detail: "4.0 m x 4.0 m", color: "bg-status-fail" },
  { tag: "", title: "Generator", detail: "3.0 m x 1.1 m", color: "bg-muted-foreground" },
];

type ConfigSidebarProps = {
  selection: TemplateSelection;
  onSelectionChange: (selection: TemplateSelection) => void;
  onPlaceTemplate: () => void;
  onFlipLayout: () => void;
  onFindBestFit: () => void;
  onFindMaxConfiguration: () => void;
};

export function ConfigSidebar({
  selection,
  onSelectionChange,
  onPlaceTemplate,
  onFlipLayout,
  onFindBestFit,
  onFindMaxConfiguration,
}: ConfigSidebarProps) {
  const definition = buildTemplateDefinition(selection);

  const dimensions = [
    { label: "Width", value: `${definition.width.toFixed(2)} m` },
    { label: "Depth", value: `${definition.depth.toFixed(2)} m` },
    { label: "Pod Length", value: `${definition.podLength.toFixed(2)} m` },
    { label: "Pod Width", value: `${definition.podWidth.toFixed(2)} m` },
    { label: "Footprint", value: `${definition.area.toFixed(2)} m2` },
    { label: "Approx. Land", value: `${definition.cents.toFixed(2)} cents` },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-panel lg:h-full lg:w-[300px]">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wide text-foreground">Stack n Stock</h1>
        <p className="label-caps mt-1">Site Suitability Dashboard</p>
      </header>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <section className="space-y-4 border-b border-border px-5 py-5">
          <h2 className="label-caps">Configuration</h2>
          {GROUPS.map((group) => (
            <div key={group.key}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="flex gap-1.5">
                {group.options.map((option) => {
                  const active = selection[group.key] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        if (group.key === "height") {
                          onSelectionChange({ ...selection, height: option as HeightCode });
                        } else if (group.key === "series") {
                          onSelectionChange({ ...selection, series: option as SeriesCode });
                        } else {
                          onSelectionChange({ ...selection, parallel: option as ParallelCode });
                        }
                      }}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1.5 font-display text-sm font-semibold tracking-wide transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Current ground geometry is driven by S and R. Each 40-ft HC pod is 12.192 m long x 2.438 m wide, with 2.50 m utility-side and 1.50 m opposite-side end caps. The 1.80 m rear bike connection is additional depth. H1, H2 and H3 keep the same ground footprint for the same S/R combination.
          </p>
        </section>

        <section className="border-b border-border px-5 py-5">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="label-caps">Selected Configuration</h3>
            <p className="mt-2 font-display text-2xl font-bold tracking-wider text-primary">{definition.code}</p>
            <p className="label-caps mt-4">Template Dimensions</p>
            <dl className="mt-2 space-y-1.5">
              {dimensions.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="font-mono text-foreground">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-b border-border px-5 py-5">
          <h2 className="label-caps">Site Template Zones</h2>
          <ul className="mt-3 space-y-2.5">
            {ZONES.map((zone) => (
              <li key={zone.title} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded font-display text-[11px] font-bold text-background",
                    zone.color,
                  )}
                >
                  {zone.tag}
                </span>
                <span className="text-sm leading-tight text-foreground">
                  {zone.title}
                  {zone.detail && (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">{zone.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-2 border-t border-border bg-panel px-5 py-4">
        <Button className="w-full font-display uppercase tracking-wider" onClick={onPlaceTemplate}>
          Place / Reset Template
        </Button>
        <Button
          variant="outline"
          className="w-full font-display uppercase tracking-wider"
          onClick={onFlipLayout}
          title="Mirror b | A | B to B | A | b"
        >
          Flip Layout
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="font-display text-xs uppercase tracking-wider"
            onClick={onFindBestFit}
            title="Automatically search positions and rotations for the selected configuration"
          >
            Find Best Fit
          </Button>
          <Button
            variant="secondary"
            className="font-display text-xs uppercase tracking-wider"
            onClick={onFindMaxConfiguration}
            title="Find the largest S/R ground configuration that fits the current parcel"
          >
            Find Max Config
          </Button>
        </div>
      </div>
    </aside>
  );
}
