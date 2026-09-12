import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klartext",
    short_name: "Klartext",
    description:
      "Präzises Diktat und Audio-Transkription im Browser und auf dem Desktop.",
    start_url: "/",
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
