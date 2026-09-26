import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/shared/site";

export const baseMetadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  applicationName: "Nivune",
  appleWebApp: {
    capable: true,
    title: "Nivune",
    statusBarStyle: "default",
  },
};

export const baseViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#151b27" },
  ],
};
