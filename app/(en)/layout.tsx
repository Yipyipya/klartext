import RootDocument from "@/components/site/RootDocument";
import { baseMetadata, baseViewport } from "@/components/site/metadata";

export const metadata = baseMetadata;
export const viewport = baseViewport;

export default function EnglishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
