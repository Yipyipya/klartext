import Landing from "@/components/site/Landing";
import { landingMetadata } from "@/components/site/page-metadata";

export const metadata = landingMetadata("en");

export default function EnglishHomePage() {
  return <Landing lang="en" />;
}
