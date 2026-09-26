import { Figtree } from "next/font/google";
import "../../app/globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

/** Gemeinsames HTML-Gerüst für die deutschen und englischen Root-Layouts. */
export default function RootDocument({
  lang,
  children,
}: Readonly<{ lang: "de" | "en"; children: React.ReactNode }>) {
  return (
    <html lang={lang} suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <head>
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
