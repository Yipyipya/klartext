import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/shared/site";

// Der Arbeitsbereich bleibt unabhängig von der Website immer noindex.
export const metadata: Metadata = {
  title: "Nivune · Voice Workspace",
  description: "Diktieren und Audio transkribieren, lokal oder mit deinem eigenen KI-Anbieter.",
  robots: NOINDEX_ROBOTS,
};

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
