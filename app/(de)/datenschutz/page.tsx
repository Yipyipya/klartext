import Privacy from "@/components/site/Privacy";
import { landingMetadata } from "@/components/site/page-metadata";

export const metadata = landingMetadata("de", "privacy");

export default function PrivacyPage() {
  return <Privacy lang="de" />;
}
