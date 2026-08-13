import { requirePlatformAdmin } from "@/lib/platform-admin";
import PlatformOverviewClient from "./PlatformOverviewClient";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  return <PlatformOverviewClient />;
}
