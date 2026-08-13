import { requirePlatformAdmin } from "@/lib/platform-admin";
import JobsClient from "./JobsClient";

export const dynamic = "force-dynamic";

export default async function PlatformJobsPage() {
  await requirePlatformAdmin();
  return <JobsClient />;
}
