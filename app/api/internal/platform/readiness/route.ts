import { apiError, json } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformDataReadinessChecks, productionReadinessChecks } from "@/lib/production-readiness";
import { getBindings, getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin("platform:read");
    const checks = [
      ...productionReadinessChecks(getBindings()),
      ...await platformDataReadinessChecks(getDatabase()),
    ];
    return json({ ok: true, ready: checks.every((item) => item.ok), checks });
  } catch (error) {
    return apiError(error, request);
  }
}
