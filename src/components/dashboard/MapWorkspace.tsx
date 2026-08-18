import {
  Search,
  Satellite,
  PencilRuler,
  Eraser,
  Route,
  Plus,
  Minus,
  RotateCw,
  Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TOOLS = [
  { icon: Plus, label: "Zoom in" },
  { icon: Minus, label: "Zoom out" },
  { icon: RotateCw, label: "Rotate" },
  { icon: Maximize, label: "Reset view" },
];

export function MapWorkspace() {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search location…"
            className="h-9 border-border bg-secondary/40 pl-9 text-sm"
          />
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Satellite className="h-4 w-4" /> Satellite
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <PencilRuler className="h-4 w-4" /> Draw Parcel
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Eraser className="h-4 w-4" /> Clear Parcel
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Route className="h-4 w-4" /> Mark Road
        </Button>
      </div>

      <div className="relative min-h-[420px] flex-1 p-4">
        <div className="grid-backdrop relative flex h-full min-h-[400px] items-center justify-center overflow-hidden rounded-lg border border-border">
          <div className="px-6 text-center">
            <h2 className="font-display text-lg font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Satellite Map Workspace
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground/70">
              Google satellite map integration will be added in the next step.
            </p>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-1.5 rounded-md border border-border bg-card/90 p-1.5 backdrop-blur">
            {TOOLS.map((tool) => (
              <Button
                key={tool.label}
                variant="ghost"
                size="icon"
                aria-label={tool.label}
                title={tool.label}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
