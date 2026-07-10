import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klartext",
    short_name: "Klartext",
    description:
      "Sprich. Der Rest ist Text. Live-Diktat und Audio-Transkription direkt im Browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
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
