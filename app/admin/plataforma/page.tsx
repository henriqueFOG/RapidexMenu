import { requirePlatformAdmin } from "@/lib/platform-admin";
import PlatformConsoleClient from "./PlatformConsoleClient";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  return <PlatformConsoleClient />;
}
