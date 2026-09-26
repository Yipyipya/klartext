import RootDocument from "@/components/site/RootDocument";
import { baseMetadata, baseViewport } from "@/components/site/metadata";

export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function GermanRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="de">{children}</RootDocument>;
}
