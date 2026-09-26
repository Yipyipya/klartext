import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nivune",
    short_name: "Nivune",
    description:
      "Präzises Diktat und Audio-Transkription im Browser und auf dem Desktop.",
    // Die Identität bleibt "/", damit bestehende Installationen dieselbe App bleiben.
    id: "/",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbfcfe",
    theme_color: "#fbfcfe",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
