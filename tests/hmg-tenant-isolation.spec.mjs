import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const rawRunId = process.env.RAPIDEX_PUBLIC_E2E_RUN_ID || `${Date.now()}`;
const suffix = rawRunId.replace(/\D/g, "").slice(-7) || `${Date.now()}`.slice(-7);
const password = "RapidexTenant123";
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP94AAAAASUVORK5CYII=",
  "base64",
);

test.use({ baseURL });
test.setTimeout(120_000);

async function signup(browser, tenant) {
  const context = await browser.newContext({ baseURL });
  const email = `tenant.${tenant.toLowerCase()}.${suffix}@rapidex-hmg.test`;
  const name = `Restaurante ${tenant} ${suffix}`;
  const response = await context.request.post(`${baseURL}/api/auth/signup`, {
    data: {
      ownerName: `Dono ${tenant}`,
      restaurantName: name,
      email,
      phone: `24${tenant === "A" ? "91" : "92"}${suffix.padStart(7, "0")}`.slice(0, 11),
      city: "Petrópolis",
      state: "RJ",
      password,
      termsAccepted: true,
      privacyAccepted: true,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const payload = await response.json();
  expect(payload.restaurant?.id).toBeTruthy();
  expect(payload.restaurant?.slug).toBeTruthy();

  const settings = await context.request.patch(`${baseURL}/api/admin/settings`, {
    data: { isOpen: true, deliveryFeeCents: 0, minimumOrderCents: 0 },
  });
  expect(settings.status(), await settings.text()).toBe(200);

  return { context, restaurant: payload.restaurant, email, name };
}

async function createProduct(tenant, productName) {
  const response = await tenant.context.request.post(`${baseURL}/api/admin/products`, {
    data: {
      name: productName,
      description: `Produto exclusivo de ${tenant.name}`,
      priceCents: 2990,
      costCents: 1000,
      prepMinutes: 10,
      emoji: "🍔",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id;
}

test("HMG segurança: restaurante A não acessa dados do B e vice-versa", async ({ browser }) => {
  const tenantA = await signup(browser, "A");
  const tenantB = await signup(browser, "B");

  try {
    const productAName = `Produto A ${suffix}`;
    const productBName = `Produto B ${suffix}`;
    const productA = await createProduct(tenantA, productAName);
    const productB = await createProduct(tenantB, productBName);

    await test.step("catálogos são isolados e IDs de outra empresa não podem ser alterados", async () => {
      const [catalogAResponse, catalogBResponse] = await Promise.all([
        tenantA.context.request.get(`${baseURL}/api/admin/products`),
        tenantB.context.request.get(`${baseURL}/api/admin/products`),
      ]);
      expect(catalogAResponse.status()).toBe(200);
      expect(catalogBResponse.status()).toBe(200);
      const catalogA = await catalogAResponse.json();
      const catalogB = await catalogBResponse.json();
      expect(catalogA.products.some((product) => product.id === productA)).toBe(true);
      expect(catalogA.products.some((product) => product.id === productB)).toBe(false);
      expect(catalogB.products.some((product) => product.id === productB)).toBe(true);
      expect(catalogB.products.some((product) => product.id === productA)).toBe(false);

      const bAttacksA = await tenantB.context.request.patch(`${baseURL}/api/admin/products/${productA}`, {
        data: { available: false },
      });
      expect(bAttacksA.status()).toBe(404);
      expect((await bAttacksA.json()).error?.code).toBe("product_not_found");

      const aAttacksB = await tenantA.context.request.patch(`${baseURL}/api/admin/products/${productB}`, {
        data: { available: false },
      });
      expect(aAttacksB.status()).toBe(404);
      expect((await aAttacksB.json()).error?.code).toBe("product_not_found");
    });

    let imageKey = "";
    await test.step("mídia pertence ao restaurante que fez o upload", async () => {
      const upload = await tenantA.context.request.post(`${baseURL}/api/admin/uploads`, {
        multipart: {
          file: { name: "produto-a.png", mimeType: "image/png", buffer: tinyPng },
        },
      });
      expect(upload.status(), await upload.text()).toBe(201);
      const uploaded = await upload.json();
      imageKey = uploaded.key;
      expect(imageKey).toContain(`/restaurants/${tenantA.restaurant.id}/products/`);

      const bindA = await tenantA.context.request.patch(`${baseURL}/api/admin/products/${productA}`, {
        data: { imageKey },
      });
      expect(bindA.status(), await bindA.text()).toBe(200);

      const publicImage = await tenantA.context.request.get(`${baseURL}${uploaded.url}`);
      expect(publicImage.status()).toBe(200);
      expect(publicImage.headers()["content-type"]).toContain("image/png");

      const bTriesForeignImage = await tenantB.context.request.patch(`${baseURL}/api/admin/products/${productB}`, {
        data: { imageKey },
      });
      expect(bTriesForeignImage.status()).toBe(400);
      expect((await bTriesForeignImage.json()).error?.code).toBe("invalid_media_owner");
    });

    let orderAId = "";
    const customerAName = `Cliente exclusivo A ${suffix}`;
    await test.step("pedido e cliente criados em A não aparecem para B", async () => {
      const order = await tenantA.context.request.post(`${baseURL}/api/public/orders`, {
        data: {
          restaurantSlug: tenantA.restaurant.slug,
          clientOrderId: `tenant-a-${suffix}-${Date.now()}`,
          source: "menu",
          customer: {
            name: customerAName,
            phone: `24${(`800000000${suffix}`).slice(-9)}`,
            email: `cliente.a.${suffix}@rapidex-hmg.test`,
            whatsappConsent: false,
            address: {
              street: "Rua Isolamento",
              number: "10",
              neighborhood: "Centro",
              city: "Petrópolis",
              state: "RJ",
              postalCode: "25600000",
            },
          },
          items: [{ productId: productA, quantity: 1 }],
          paymentMethod: "card_on_delivery",
        },
      });
      expect(order.status(), await order.text()).toBe(201);
      orderAId = (await order.json()).order.id;

      const ordersBResponse = await tenantB.context.request.get(`${baseURL}/api/admin/orders`);
      expect(ordersBResponse.status()).toBe(200);
      const ordersB = (await ordersBResponse.json()).orders;
      expect(ordersB.some((row) => row.id === orderAId)).toBe(false);
      expect(ordersB.some((row) => row.customer_name === customerAName)).toBe(false);

      const customersBResponse = await tenantB.context.request.get(`${baseURL}/api/admin/customers`);
      expect(customersBResponse.status()).toBe(200);
      const customersB = (await customersBResponse.json()).customers;
      expect(customersB.some((row) => row.name === customerAName)).toBe(false);

      const customersAResponse = await tenantA.context.request.get(`${baseURL}/api/admin/customers`);
      expect(customersAResponse.status()).toBe(200);
      expect((await customersAResponse.json()).customers.some((row) => row.name === customerAName)).toBe(true);
    });

    await test.step("B não consegue alterar pedido de A mesmo conhecendo o ID", async () => {
      const attack = await tenantB.context.request.patch(`${baseURL}/api/admin/orders/${orderAId}`, {
        data: { status: "confirmed", expectedStatus: "received" },
      });
      expect(attack.status()).toBe(404);
      expect((await attack.json()).error?.code).toBe("order_not_found");

      const ownerAStillControls = await tenantA.context.request.patch(`${baseURL}/api/admin/orders/${orderAId}`, {
        data: { status: "confirmed", expectedStatus: "received" },
      });
      expect(ownerAStillControls.status(), await ownerAStillControls.text()).toBe(200);
    });

    await test.step("overview de cada conta permanece preso ao seu próprio restaurante", async () => {
      const [overviewAResponse, overviewBResponse] = await Promise.all([
        tenantA.context.request.get(`${baseURL}/api/admin/overview`),
        tenantB.context.request.get(`${baseURL}/api/admin/overview`),
      ]);
      const overviewA = await overviewAResponse.json();
      const overviewB = await overviewBResponse.json();
      expect(overviewA.restaurant.id).toBe(tenantA.restaurant.id);
      expect(overviewB.restaurant.id).toBe(tenantB.restaurant.id);
      expect(overviewA.restaurant.id).not.toBe(overviewB.restaurant.id);
      expect(JSON.stringify(overviewB)).not.toContain(productAName);
      expect(JSON.stringify(overviewB)).not.toContain(customerAName);
    });
  } finally {
    for (const tenant of [tenantA, tenantB]) {
      const cleanup = await tenant.context.request.post(`${baseURL}/api/auth/test-cleanup`, {
        headers: { origin: new URL(baseURL).origin },
      });
      expect([200, 401]).toContain(cleanup.status());
    }
    await tenantA.context.close();
    await tenantB.context.close();
  }
});
