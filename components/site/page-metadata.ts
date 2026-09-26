import type { Metadata } from "next";
import { LANDING_COPY, type SiteLanguage } from "./landing-content";
import { MARKETING_ROBOTS, SITE_INDEXABLE } from "@/shared/site";

/** Metadaten der Marketingseiten; Canonical und Sprachalternativen nur mit finaler Adresse. */
export function landingMetadata(lang: SiteLanguage, page: "home" | "privacy" = "home"): Metadata {
  const copy = LANDING_COPY[lang];
  const paths = page === "home"
    ? { de: LANDING_COPY.de.path, en: LANDING_COPY.en.path }
    : { de: LANDING_COPY.de.privacyPath, en: LANDING_COPY.en.privacyPath };
  const title = page === "home" ? copy.meta.title : lang === "de" ? "Datenschutz · Nivune" : "Privacy · Nivune";
  return {
    title,
    description: copy.meta.description,
    robots: MARKETING_ROBOTS,
    ...(SITE_INDEXABLE ? {
      alternates: { canonical: paths[lang], languages: { de: paths.de, en: paths.en, "x-default": paths.de } },
      openGraph: {
        type: "website",
        siteName: "Nivune",
        title,
        description: copy.meta.description,
        url: paths[lang],
        locale: lang === "de" ? "de_DE" : "en_US",
        images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Nivune" }],
      },
      twitter: { card: "summary_large_image", title, description: copy.meta.description, images: ["/og-image.png"] },
    } : {}),
  };
}
