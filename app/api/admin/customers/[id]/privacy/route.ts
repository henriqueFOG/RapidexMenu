import { audit, requireAdminContext, requireRole } from "@/lib/admin-auth";
import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { getDatabase } from "@/lib/runtime";
import { optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const customerId = requiredString((await params).id, "Cliente", 2, 100);
    const db = getDatabase();
    const customer = await ownedCustomer(db, context.restaurantId, customerId);
    const [orders, preferences, conversations, requests] = await Promise.all([
      db.prepare(
        `SELECT id, order_number, source, fulfillment_type, table_code, status, payment_status, payment_method,
                subtotal_cents, delivery_fee_cents, total_cents, address_json, notes, created_at, updated_at
         FROM orders WHERE restaurant_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 500`,
      ).bind(context.restaurantId, customerId).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT kind, value, confidence, source, created_at, updated_at
         FROM customer_preferences WHERE customer_id = ? ORDER BY created_at DESC`,
      ).bind(customerId).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT id, channel, external_contact_id, status, last_message_at, created_at, updated_at
         FROM conversations WHERE restaurant_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 200`,
      ).bind(context.restaurantId, customerId).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT id, request_type, status, requester_reference, details_json, requested_at, completed_at, completed_by
         FROM privacy_requests WHERE restaurant_id = ? AND customer_id = ? ORDER BY requested_at DESC`,
      ).bind(context.restaurantId, customerId).all<Record<string, unknown>>(),
    ]);

    const conversationIds = conversations.results.map((conversation) => String(conversation.id));
    const messages = conversationIds.length
      ? await db.prepare(
          `SELECT conversation_id, direction, type, body, status, created_at
           FROM messages WHERE conversation_id IN (${conversationIds.map(() => "?").join(",")})
           ORDER BY created_at DESC LIMIT 1000`,
        ).bind(...conversationIds).all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] };

    const exportPayload = {
      generatedAt: Date.now(),
      restaurantId: context.restaurantId,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        defaultAddress: parseJson(customer.default_address_json),
        whatsappConsent: Boolean(customer.whatsapp_consent),
        consentAt: customer.consent_at,
        marketingOptOutAt: customer.marketing_opt_out_at,
        orderCount: customer.order_count,
        lifetimeValueCents: customer.lifetime_value_cents,
        lastOrderAt: customer.last_order_at,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
      },
      orders: orders.results.map((order) => ({
        ...order,
        address_json: parseJson(order.address_json),
      })),
      preferences: preferences.results,
      conversations: conversations.results.map((conversation) => ({
        ...conversation,
        messages: messages.results.filter((message) => message.conversation_id === conversation.id),
      })),
      privacyRequests: requests.results.map((request) => ({
        ...request,
        details_json: parseJson(request.details_json),
      })),
    };

    await audit(context, "privacy.customer_exported", "customer", customerId, { scope: "lgpd_export" });
    return json({ ok: true, export: exportPayload });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAdminContext();
    requireRole(context, ["owner", "manager"]);
    const customerId = requiredString((await params).id, "Cliente", 2, 100);
    const body = await readJson<Record<string, unknown>>(request, 30_000);
    const action = requiredString(body.action, "Ação", 3, 30);
    const db = getDatabase();
    await ownedCustomer(db, context.restaurantId, customerId);
    const now = Date.now();

    if (action === "opt_out") {
      await db.prepare(
        `UPDATE customers SET whatsapp_consent = 0, marketing_opt_out_at = ?, updated_at = ?
         WHERE id = ? AND restaurant_id = ?`,
      ).bind(now, now, customerId, context.restaurantId).run();
      await recordRequest(db, context.restaurantId, customerId, "opt_out", "completed", {
        source: "admin_privacy_action",
      }, context.user.email, now);
      await audit(context, "privacy.opt_out_applied", "customer", customerId, {});
      return json({ ok: true, status: "completed" });
    }

    if (action === "correction") {
      const name = body.name === undefined ? undefined : requiredString(body.name, "Nome", 2, 80);
      const email = body.email === undefined ? undefined : optionalString(body.email, "E-mail", 160);
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
      }
      if (name === undefined && email === undefined) {
        throw new HttpError(400, "Informe ao menos um campo para correção.", "validation_error");
      }
      const customer = await ownedCustomer(db, context.restaurantId, customerId);
      await db.prepare(
        `UPDATE customers SET name = ?, email = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?`,
      ).bind(
        name ?? customer.name,
        email === undefined ? customer.email : email,
        now,
        customerId,
        context.restaurantId,
      ).run();
      await recordRequest(db, context.restaurantId, customerId, "correction", "completed", {
        correctedFields: [name !== undefined ? "name" : null, email !== undefined ? "email" : null].filter(Boolean),
      }, context.user.email, now);
      await audit(context, "privacy.customer_corrected", "customer", customerId, {
        fields: [name !== undefined ? "name" : null, email !== undefined ? "email" : null].filter(Boolean),
      });
      return json({ ok: true, status: "completed" });
    }

    if (action === "deletion_request" || action === "access_request" || action === "portability_request") {
      const requestType = action === "deletion_request" ? "deletion" : action === "access_request" ? "access" : "portability";
      const requesterReference = optionalString(body.requesterReference, "Referência do solicitante", 160);
      const details = optionalString(body.details, "Detalhes", 1000);
      const id = await recordRequest(db, context.restaurantId, customerId, requestType, "pending", {
        details,
        destructiveActionDeferred: requestType === "deletion",
        reason: requestType === "deletion" ? "retention_and_legal_basis_review_required" : null,
      }, requesterReference || context.user.email, now);
      await audit(context, `privacy.${requestType}_requested`, "customer", customerId, { requestId: id });
      return json({
        ok: true,
        requestId: id,
        status: "pending",
        destructiveActionDeferred: requestType === "deletion",
      }, { status: 201 });
    }

    throw new HttpError(400, "Ação de privacidade inválida.", "validation_error", { field: "action" });
  } catch (error) {
    return apiError(error);
  }
}

async function ownedCustomer(db: D1Database, restaurantId: string, customerId: string) {
  const customer = await db.prepare(
    `SELECT id, name, phone, email, default_address_json, whatsapp_consent, consent_at,
            marketing_opt_out_at, order_count, lifetime_value_cents, last_order_at, created_at, updated_at
     FROM customers WHERE id = ? AND restaurant_id = ? LIMIT 1`,
  ).bind(customerId, restaurantId).first<Record<string, unknown>>();
  if (!customer) throw new HttpError(404, "Cliente não encontrado.", "customer_not_found");
  return customer;
}

async function recordRequest(
  db: D1Database,
  restaurantId: string,
  customerId: string,
  requestType: string,
  status: string,
  details: Record<string, unknown>,
  completedByOrRequester: string,
  now: number,
) {
  const id = crypto.randomUUID();
  const completed = status === "completed";
  await db.prepare(
    `INSERT INTO privacy_requests
     (id, restaurant_id, customer_id, request_type, status, requester_reference, details_json,
      requested_at, completed_at, completed_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, restaurantId, customerId, requestType, status,
    completed ? null : completedByOrRequester,
    JSON.stringify(details), now,
    completed ? now : null,
    completed ? completedByOrRequester : null,
    now, now,
  ).run();
  return id;
}

function parseJson(value: unknown) {
  if (!value) return null;
  try { return JSON.parse(String(value)); } catch { return null; }
}
