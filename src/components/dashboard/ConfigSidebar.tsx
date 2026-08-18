import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const GROUPS = [
  { key: "height", label: "Height", options: ["H1", "H2", "H3"] },
  { key: "series", label: "Series", options: ["S1", "S2"] },
  { key: "parallel", label: "Parallel", options: ["R1", "R2"] },
] as const;

const ZONES = [
  { tag: "b", title: "Bike Dispatch Side", detail: "2.50 m", color: "bg-primary" },
  { tag: "A", title: "Pod / Container", detail: null, color: "bg-status-pass" },
  { tag: "B", title: "Main Operations", detail: "5.00 m", color: "bg-status-warn" },
  { tag: "", title: "Rear Bike Connection", detail: "1.80 m", color: "bg-muted-foreground" },
  { tag: "X", title: "Utility Area", detail: null, color: "bg-status-fail" },
  { tag: "", title: "Generator", detail: "3.0 m × 1.1 m", color: "bg-muted-foreground" },
];

const DIMENSIONS = [
  { label: "Width", value: "9.94 m" },
  { label: "Depth", value: "15.80 m" },
  { label: "Footprint", value: "157.05 m²" },
  { label: "Approx. Land", value: "3.88 cents" },
];

export function ConfigSidebar() {
  const [selection, setSelection] = useState<Record<string, string>>({
    height: "H1",
    series: "S1",
    parallel: "R1",
  });

  const code = `${selection["height"]} ${selection["series"]} ${selection["parallel"]}`;

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-panel lg:h-full lg:w-[300px]">
      <header className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wide text-foreground">
          Stack n Stock
        </h1>
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
                    onClick={() =>
                      setSelection((prev) => ({ ...prev, [group.key]: option }))
                    }
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
      </section>

      <section className="border-b border-border px-5 py-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="label-caps">Selected Configuration</h3>
          <p className="mt-2 font-display text-2xl font-bold tracking-wider text-primary">
            {code}
          </p>
          <p className="label-caps mt-4">Template Dimensions</p>
          <dl className="mt-2 space-y-1.5">
            {DIMENSIONS.map((d) => (
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
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {zone.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      </div>

      <div className="space-y-2 border-t border-border bg-panel px-5 py-4">
        <Button className="w-full font-display uppercase tracking-wider">
          Place Template
        </Button>
        <Button variant="outline" className="w-full font-display uppercase tracking-wider">
          Flip Layout
        </Button>
      </div>
    </aside>
  );
}
