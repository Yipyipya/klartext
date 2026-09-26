import Privacy from "@/components/site/Privacy";
import { landingMetadata } from "@/components/site/page-metadata";

export const metadata = landingMetadata("en", "privacy");

export default function EnglishPrivacyPage() {
  return <Privacy lang="en" />;
}
