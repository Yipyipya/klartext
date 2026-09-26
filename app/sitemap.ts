import type { MetadataRoute } from "next";
import { SITE_URL } from "../shared/site";

// Ohne finale Adresse gibt es keine Sitemap; der Arbeitsbereich /app ist nie enthalten.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;
  return [
    { url: url("/"), alternates: { languages: { de: url("/"), en: url("/en") } } },
    { url: url("/en"), alternates: { languages: { de: url("/"), en: url("/en") } } },
    { url: url("/datenschutz"), alternates: { languages: { de: url("/datenschutz"), en: url("/en/privacy") } } },
    { url: url("/en/privacy"), alternates: { languages: { de: url("/datenschutz"), en: url("/en/privacy") } } },
  ];
}
