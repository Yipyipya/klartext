import type { Metadata, Viewport } from "next";
import { EB_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Klartext. Sprich. Der Rest ist Text.",
  description:
    "Diktiere live in deiner Sprache oder lade Sprachaufnahmen hoch und erhalte sauberen, kopierfertigen Text. Kostenlos, privat, direkt im Browser.",
  applicationName: "Klartext",
  appleWebApp: {
    capable: true,
    title: "Klartext",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#17140f" },
  ],
};

const themeInit = `try{var t=localStorage.getItem("klartext.theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.theme="dark"}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${figtree.variable} ${garamond.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
