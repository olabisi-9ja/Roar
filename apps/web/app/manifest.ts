import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Roar",
    short_name: "Roar",
    description: "Every fan is another angle. Live match intelligence, crowd Moments, games and stadium safety.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#3A0648",
    categories: ["sports", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home screen icon for these.
    shortcuts: [
      { name: "Capture", url: "/capture", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Live", url: "/live", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "SOS", url: "/sos", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
