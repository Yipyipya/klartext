import Landing from "@/components/site/Landing";
import { landingMetadata } from "@/components/site/page-metadata";

export const metadata = landingMetadata("de");

export default function HomePage() {
  return <Landing lang="de" />;
}
