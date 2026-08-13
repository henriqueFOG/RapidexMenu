import { requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, json } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const db = getDatabase();
    const [requests, customers] = await Promise.all([
      db.prepare(
        `SELECT pr.id, pr.customer_id, pr.request_type, pr.status, pr.requester_reference,
                pr.details_json, pr.requested_at, pr.completed_at, pr.completed_by,
                c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
         FROM privacy_requests pr
         LEFT JOIN customers c ON c.id = pr.customer_id AND c.restaurant_id = pr.restaurant_id
         WHERE pr.restaurant_id = ?
         ORDER BY CASE pr.status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, pr.requested_at DESC
         LIMIT 300`,
      ).bind(context.restaurantId).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT id, name, phone, email, whatsapp_consent, marketing_opt_out_at, order_count,
                lifetime_value_cents, last_order_at, created_at
         FROM customers WHERE restaurant_id = ? ORDER BY COALESCE(last_order_at, created_at) DESC LIMIT 300`,
      ).bind(context.restaurantId).all<Record<string, unknown>>(),
    ]);
    return json({
      ok: true,
      requests: requests.results.map((request) => ({ ...request, details_json: parseJson(request.details_json) })),
      customers: customers.results,
    });
  } catch (error) {
    return apiError(error);
  }
}

function parseJson(value: unknown) {
  if (!value) return {};
  try { return JSON.parse(String(value)); } catch { return {}; }
}
