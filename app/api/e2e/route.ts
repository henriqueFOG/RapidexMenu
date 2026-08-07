import { createHmgSessionToken, HMG_SESSION_COOKIE } from "@/app/chatgpt-auth";
import { getDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const base = new URL(request.url).origin;
  const runId = `e2e-${Date.now()}`;
  const productName = `E2E Burger ${runId}`;
  const clientOrderId = `${runId}-order`;
  const testPhone = `55249${String(Date.now()).slice(-8)}`;
  const checks: Array<{ name: string; ok: boolean; details?: unknown }> = [];
  const db = getDatabase();
  let productId: string | null = null;
  let orderId: string | null = null;
  let trackingToken: string | null = null;
  let customerId: string | null = null;

  const check = (name: string, ok: boolean, details?: unknown) => {
    checks.push({ name, ok, ...(details === undefined ? {} : { details }) });
    if (!ok) throw new Error(`E2E failed: ${name}`);
  };

  try {
    const health = await getJson(`${base}/api/health`);
    check("health/postgres", health.response.status === 200 && health.body?.ok === true && health.body?.integrations?.database === true && health.body?.integrations?.databaseEngine === "postgres", health.body);

    const unauthorized = await getJson(`${base}/api/admin/overview`);
    check("admin unauthorized returns 401", unauthorized.response.status === 401, unauthorized.body);

    const menuBefore = await getJson(`${base}/api/public/menu/serra-burger`);
    check("public menu loads", menuBefore.response.status === 200 && menuBefore.body?.ok === true, { status: menuBefore.response.status });

    const session = await createHmgSessionToken();
    const cookie = `${HMG_SESSION_COOKIE}=${session.value}`;
    const originHeaders = { origin: base, cookie, "content-type": "application/json" };

    const createProduct = await fetch(`${base}/api/admin/products`, {
      method: "POST",
      headers: originHeaders,
      body: JSON.stringify({
        name: productName,
        description: "Produto temporário criado pelo teste E2E de homologação.",
        priceCents: 2590,
        costCents: 900,
        categoryId: "cat_burgers",
        emoji: "🧪",
        tag: "E2E",
        prepMinutes: 7,
      }),
    });
    const createProductBody = await safeJson(createProduct);
    productId = typeof createProductBody?.id === "string" ? createProductBody.id : null;
    check("company creates menu product", createProduct.status === 201 && createProductBody?.ok === true && Boolean(productId), createProductBody);

    const menuAfter = await getJson(`${base}/api/public/menu/serra-burger`);
    const allProducts = [
      ...(menuAfter.body?.categories ?? []).flatMap((category: { products?: unknown[] }) => category.products ?? []),
      ...(menuAfter.body?.uncategorized ?? []),
    ] as Array<{ id?: string; name?: string; priceCents?: number }>;
    check("new product is public", allProducts.some((product) => product.id === productId && product.name === productName && product.priceCents === 2590));

    const orderPayload = {
      restaurantSlug: "serra-burger",
      clientOrderId,
      source: "menu",
      customer: {
        name: "Cliente E2E Rapidex",
        phone: testPhone,
        email: "e2e.rapidex@example.com",
        whatsappConsent: false,
        address: {
          street: "Rua Teste Automatizado",
          number: "100",
          neighborhood: "Centro",
          city: "Petrópolis",
          state: "RJ",
          postalCode: "25600000",
          complement: "HOMOLOGAÇÃO - NÃO ENTREGAR",
        },
      },
      items: [{ productId, quantity: 1, priceCents: 1, notes: "E2E TESTE" }],
      paymentMethod: "cash",
      notes: "E2E AUTOMATIZADO - NÃO PREPARAR/NÃO ENTREGAR",
    };

    const firstOrderResponse = await fetch(`${base}/api/public/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const firstOrder = await safeJson(firstOrderResponse);
    orderId = typeof firstOrder?.order?.id === "string" ? firstOrder.order.id : null;
    trackingToken = typeof firstOrder?.order?.trackingToken === "string" ? firstOrder.order.trackingToken : null;
    check("customer creates order", firstOrderResponse.status === 201 && firstOrder?.ok === true && Boolean(orderId) && Boolean(trackingToken), firstOrder);
    check("server recalculates price", firstOrder?.order?.subtotalCents === 2590 && firstOrder?.order?.deliveryFeeCents === 690 && firstOrder?.order?.totalCents === 3280, firstOrder?.order);

    const orderRow = orderId
      ? await db.prepare("SELECT customer_id, status, total_cents FROM orders WHERE id = ? LIMIT 1").bind(orderId).first<{ customer_id: string; status: string; total_cents: number }>()
      : null;
    customerId = orderRow?.customer_id ?? null;
    check("order persisted in database", Boolean(orderRow) && orderRow?.status === "received" && Number(orderRow?.total_cents) === 3280, orderRow);

    const repeatedResponse = await fetch(`${base}/api/public/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const repeated = await safeJson(repeatedResponse);
    check("idempotency prevents duplicate", repeatedResponse.status === 200 && repeated?.order?.existing === true && repeated?.order?.id === orderId, repeated?.order);

    const duplicateCount = await db.prepare("SELECT count(*) AS total FROM orders WHERE restaurant_id = 'rest_serra_burger' AND client_order_id = ?").bind(clientOrderId).first<{ total: number }>();
    check("database has one order for clientOrderId", Number(duplicateCount?.total) === 1, duplicateCount);

    const trackingInitial = trackingToken ? await getJson(`${base}/api/public/orders/${trackingToken}`) : null;
    check("tracking loads", Boolean(trackingInitial) && trackingInitial!.response.status === 200 && trackingInitial!.body?.ok === true, trackingInitial?.body);
    const trackingText = JSON.stringify(trackingInitial?.body ?? {});
    check("tracking hides full address", !trackingText.includes("Rua Teste Automatizado") && !trackingText.includes("25600000"));

    const adminOrders = await fetch(`${base}/api/admin/orders`, { headers: { cookie } });
    const adminOrdersBody = await safeJson(adminOrders);
    const listed = Array.isArray(adminOrdersBody?.orders) && adminOrdersBody.orders.some((order: { id?: string }) => order.id === orderId);
    check("company receives order in admin", adminOrders.status === 200 && adminOrdersBody?.ok === true && listed, { status: adminOrders.status, listed });

    const transitions = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"];
    for (const status of transitions) {
      const response = await fetch(`${base}/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: originHeaders,
        body: JSON.stringify({ status }),
      });
      const body = await safeJson(response);
      check(`company advances order to ${status}`, response.status === 200 && body?.ok === true && body?.status === status, body);

      const tracking = trackingToken ? await getJson(`${base}/api/public/orders/${trackingToken}`) : null;
      check(`customer tracking reflects ${status}`, Boolean(tracking) && tracking!.response.status === 200 && tracking!.body?.order?.status === status, tracking?.body?.order);
    }

    const invalidTransition = await fetch(`${base}/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: originHeaders,
      body: JSON.stringify({ status: "preparing" }),
    });
    const invalidTransitionBody = await safeJson(invalidTransition);
    check("invalid status transition is blocked", invalidTransition.status === 409 && invalidTransitionBody?.ok === false && invalidTransitionBody?.error?.code === "invalid_status_transition", invalidTransitionBody);

    const auditRow = orderId
      ? await db.prepare("SELECT action FROM audit_logs WHERE entity_type = 'order' AND entity_id = ? AND action = 'order.status_changed' LIMIT 1").bind(orderId).first<{ action: string }>()
      : null;
    check("order status changes are audited", auditRow?.action === "order.status_changed", auditRow);

    return Response.json({
      ok: checks.every((item) => item.ok),
      runId,
      summary: { passed: checks.filter((item) => item.ok).length, total: checks.length },
      checks,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      runId,
      summary: { passed: checks.filter((item) => item.ok).length, total: checks.length },
      checks,
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  } finally {
    try {
      if (orderId) {
        await db.prepare("DELETE FROM audit_logs WHERE entity_type = 'order' AND entity_id = ?").bind(orderId).run();
        await db.prepare("DELETE FROM payments WHERE order_id = ?").bind(orderId).run();
        await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId).run();
        await db.prepare("DELETE FROM orders WHERE id = ?").bind(orderId).run();
      }
      if (customerId) {
        await db.prepare("DELETE FROM customers WHERE id = ? AND phone = ?").bind(customerId, testPhone).run();
      }
      if (productId) {
        await db.prepare("DELETE FROM audit_logs WHERE entity_type = 'product' AND entity_id = ?").bind(productId).run();
        await db.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();
      }
    } catch (cleanupError) {
      console.error("E2E cleanup failed", cleanupError);
    }
  }
}

async function getJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  return { response, body: await safeJson(response) };
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
