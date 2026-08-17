import { apiError, json } from "@/lib/http";
import { getRapidexEnvironment } from "@/lib/runtime";
import { systemHealth } from "@/lib/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await systemHealth();
    if (getRapidexEnvironment() !== "production") return json(health);
    return json({
      ok: true,
      service: health.service,
      status: health.status,
      checkedAt: health.checkedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
