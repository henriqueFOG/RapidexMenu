import { apiError, json } from "@/lib/http";
import { integrationReadiness, getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabase().prepare("SELECT 1 AS ok").first();
    return json({ ok: true, service: "rapidexmenu", integrations: integrationReadiness() });
  } catch (error) {
    return apiError(error);
  }
}
