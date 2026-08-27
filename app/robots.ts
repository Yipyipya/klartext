import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Crawling muss erlaubt bleiben, damit Suchmaschinen das noindex-Meta sehen.
  // Kein Sitemap-Eintrag. Dies ist kein Zugangsschutz.
  return { rules: { userAgent: "*", allow: "/" } };
}
