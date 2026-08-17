import { apiError, json } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { systemHealth } from "@/lib/system-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("platform:read");
    return json(await systemHealth());
  } catch (error) {
    return apiError(error, request);
  }
}
