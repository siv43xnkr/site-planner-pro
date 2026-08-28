import { useEffect, useState } from "react";
import { Download, FileText, FolderOpen, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SavedSite } from "@/lib/saved-sites";
import type { TemplateSelection } from "@/lib/site-types";

export function SavedSitesDialog({
  open,
  mode,
  selection,
  sites,
  onClose,
  onCreate,
  onLoad,
  onDelete,
  onReport,
  onBackup,
}: {
  open: boolean;
  mode: "save" | "manage";
  selection: TemplateSelection;
  sites: SavedSite[];
  onClose: () => void;
  onCreate: (name: string, notes: string) => void;
  onLoad: (site: SavedSite) => void;
  onDelete: (site: SavedSite) => void;
  onReport: (site: SavedSite) => void;
  onBackup: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || mode !== "save") return;
    const stamp = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    setName(`${selection.height} ${selection.series} ${selection.parallel} Site - ${stamp}`);
    setNotes("");
  }, [mode, open, selection.height, selection.parallel, selection.series]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-foreground">
              {mode === "save" ? "Save Site" : "Saved Sites"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "save"
                ? "Store the current parcel, SNS placement, rotation and screening results in this browser."
                : `${sites.length} saved site${sites.length === 1 ? "" : "s"} on this browser.`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mode === "save" ? (
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Site name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Landlord, contact, access note, survey follow-up, etc."
                className="w-full resize-none rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs leading-5 text-muted-foreground">
              Saved sites use browser local storage. Use <strong className="text-foreground">Backup JSON</strong> from Saved Sites if you want a portable copy before clearing browser data or moving computers.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  onCreate(trimmed, notes.trim());
                }}
                disabled={!name.trim()}
                className="gap-2"
              >
                <Save className="h-4 w-4" /> Save Current Site
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[72vh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">Load a saved plan or open its printable site report.</p>
              <Button variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={onBackup} disabled={sites.length === 0}>
                <Download className="h-3.5 w-3.5" /> Backup JSON
              </Button>
            </div>
            <div className="overflow-y-auto p-4">
              {sites.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
                  <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">No sites saved yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Draw and evaluate a parcel, then use Save Site.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sites.map((site) => {
                    const cents = site.parcelAreaM2 / 40.4686;
                    return (
                      <article key={site.id} className="rounded-lg border border-border bg-secondary/15 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">{site.name}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {site.selection.height} {site.selection.series} {site.selection.parallel} · {site.parcelAreaM2.toFixed(1)} m² · {cents.toFixed(2)} cents
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Updated {new Date(site.updatedAt).toLocaleString()}
                            </p>
                            {site.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{site.notes}</p>}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            <Button size="sm" className="gap-1.5" onClick={() => onLoad(site)}>
                              <FolderOpen className="h-3.5 w-3.5" /> Load
                            </Button>
                            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onReport(site)}>
                              <FileText className="h-3.5 w-3.5" /> Report
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Delete saved site"
                              onClick={() => onDelete(site)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
