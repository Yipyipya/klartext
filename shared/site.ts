// Öffentliche Website-Konfiguration. Ohne ausdrücklich gesetzte finale Adresse
// bleibt jede Seite noindex; so wird die Vorabversion nicht versehentlich
// indexiert. Beim Launch NEXT_PUBLIC_SITE_URL auf die gewählte Domain setzen.

function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_INDEXABLE = SITE_URL !== null;

/**
 * Anbieterkennzeichnung (Impressum). Name und ladungsfähige Anschrift gibt nur
 * der Projektinhaber frei; bis dahin wird kein Impressum-Link angezeigt.
 */
export const LEGAL_NOTICE_URL = process.env.NEXT_PUBLIC_LEGAL_NOTICE_URL || null;

/**
 * Sind die veröffentlichten Installer mit Developer ID notarisiert bzw. mit
 * einem Herausgeberzertifikat signiert? Erst nach echter Signierung auf "1" setzen.
 */
export const INSTALLERS_SIGNED = process.env.NEXT_PUBLIC_INSTALLERS_SIGNED === "1";

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
} as const;

export const MARKETING_ROBOTS = SITE_INDEXABLE ? { index: true, follow: true } : NOINDEX_ROBOTS;
