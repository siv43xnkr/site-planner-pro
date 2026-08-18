import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ConfigSidebar } from "@/components/dashboard/ConfigSidebar";
import { MapWorkspace } from "@/components/dashboard/MapWorkspace";
import { SuitabilitySidebar } from "@/components/dashboard/SuitabilitySidebar";

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
  const [parcelArea, setParcelArea] = useState<number | null>(null);

  return (
    <main className="flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <ConfigSidebar />
      <MapWorkspace onAreaChange={setParcelArea} />
      <SuitabilitySidebar parcelArea={parcelArea} />
    </main>
  );
}
