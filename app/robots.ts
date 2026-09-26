import type { MetadataRoute } from "next";
import { SITE_URL } from "../shared/site";

export default function robots(): MetadataRoute.Robots {
  // Crawling bleibt erlaubt, damit Suchmaschinen die noindex-Angaben sehen.
  // Eine Sitemap gibt es erst mit der finalen Adresse. Dies ist kein Zugangsschutz.
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(SITE_URL ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
