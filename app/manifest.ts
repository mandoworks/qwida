import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quida",
    short_name: "Quida",
    description: "Cuidar a mamá, aunque esté lejos. Datos sintéticos.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F0",
    theme_color: "#0B4F42",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
