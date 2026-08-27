import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klartext",
    short_name: "Klartext",
    description:
      "Präzises Diktat und Audio-Transkription im Browser und auf dem Desktop.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f3",
    theme_color: "#f2f5f3",
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
