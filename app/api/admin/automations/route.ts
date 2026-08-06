import { requireAdminContext } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    const events = await getDatabase()
      .prepare(
        `SELECT * FROM automation_events WHERE restaurant_id = ?
         ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(context.restaurantId)
      .all<Record<string, unknown>>();
    return json({ ok: true, automations: events.results });
  } catch (error) {
    return apiError(error);
  }
}
