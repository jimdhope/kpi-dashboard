import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KPI Quest",
    short_name: "KPI Quest",
    description: "Track performance, compete with colleagues, and celebrate team achievements.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#050a14",
    theme_color: "#0d2931",
    orientation: "any",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
