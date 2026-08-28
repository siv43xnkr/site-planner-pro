/// <reference types="google.maps" />

const LOCAL_BROWSER_KEY = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;
const LOVABLE_BROWSER_KEY = import.meta.env[
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"
] as string | undefined;
const LOVABLE_CHANNEL = import.meta.env[
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"
] as string | undefined;

// Local development uses VITE_GOOGLE_MAPS_API_KEY when present.
// Lovable preview remains compatible by falling back to its managed browser key.
const BROWSER_KEY = LOCAL_BROWSER_KEY?.trim() || LOVABLE_BROWSER_KEY?.trim();
const CHANNEL = LOCAL_BROWSER_KEY?.trim() ? undefined : LOVABLE_CHANNEL;

export const hasGoogleMapsKey = Boolean(BROWSER_KEY);

let loader: Promise<typeof google.maps> | null = null;

/** Loads the Google Maps JS API once (browser only). */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (!BROWSER_KEY) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. For local use, create .env.local and set VITE_GOOGLE_MAPS_API_KEY.",
      ),
    );
  }
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    if (w["google"] && (w["google"] as typeof google).maps?.Map) {
      resolve((w["google"] as typeof google).maps);
      return;
    }

    const callbackName = "__snsInitGoogleMaps";
    w[callbackName] = () => {
      resolve((window as unknown as { google: typeof google }).google.maps);
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      libraries: "geometry,places",
      callback: callbackName,
      v: "weekly",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Failed to load the Google Maps script."));
    };
    document.head.appendChild(script);
  });

  return loader;
}

export const SQM_PER_CENT = 40.4686;

export function formatArea(sqm: number) {
  return {
    sqm: sqm.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    cents: (sqm / SQM_PER_CENT).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  };
}
