import { HttpError } from "./http";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-secrets";
import { getBindings, getDatabase } from "./runtime";

export type WhatsAppConnectionRow = {
  id: string;
  restaurant_id: string;
  waba_id: string;
  business_id: string | null;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  access_token_ciphertext: string;
  two_factor_pin_ciphertext: string;
  status: string;
};

type MetaTokenPayload = { access_token?: string; token_type?: string; expires_in?: number; error?: { message?: string } };
type MetaPhone = { id?: string; display_phone_number?: string; verified_name?: string; quality_rating?: string };

export function whatsappEmbeddedSignupConfigured() {
  const env = getBindings();
  return Boolean(
    env.RAPIDEX_META_APP_ID &&
    env.RAPIDEX_META_APP_SECRET &&
    env.RAPIDEX_META_EMBEDDED_SIGNUP_CONFIG_ID &&
    env.RAPIDEX_INTEGRATION_SECRET &&
    env.RAPIDEX_INTEGRATION_SECRET.length >= 32 &&
    env.WHATSAPP_VERIFY_TOKEN &&
    env.WHATSAPP_APP_SECRET,
  );
}

export function whatsappEmbeddedSignupPublicConfig() {
  const env = getBindings();
  return {
    configured: whatsappEmbeddedSignupConfigured(),
    appId: env.RAPIDEX_META_APP_ID || "",
    configId: env.RAPIDEX_META_EMBEDDED_SIGNUP_CONFIG_ID || "",
    solutionId: env.RAPIDEX_META_SOLUTION_ID || "",
    graphVersion: env.WHATSAPP_GRAPH_VERSION || "v25.0",
  };
}

export async function getRestaurantWhatsAppConnection(restaurantId: string) {
  return getDatabase().prepare(
    `SELECT id, restaurant_id, waba_id, business_id, phone_number_id, display_phone_number,
            verified_name, access_token_ciphertext, two_factor_pin_ciphertext, status
     FROM restaurant_whatsapp_connections WHERE restaurant_id = ? AND status = 'active' LIMIT 1`,
  ).bind(restaurantId).first<WhatsAppConnectionRow>();
}

export async function getWhatsAppAccessTokenByPhoneNumberId(phoneNumberId: string) {
  const row = await getDatabase().prepare(
    `SELECT access_token_ciphertext FROM restaurant_whatsapp_connections
     WHERE phone_number_id = ? AND status = 'active' LIMIT 1`,
  ).bind(phoneNumberId).first<{ access_token_ciphertext: string }>();
  if (!row) return null;
  return decryptIntegrationSecret(row.access_token_ciphertext);
}

export async function completeWhatsAppEmbeddedSignup(input: {
  restaurantId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string | null;
}) {
  if (!whatsappEmbeddedSignupConfigured()) {
    throw new HttpError(503, "A conexão oficial do WhatsApp ainda não foi habilitada.", "integration_not_configured");
  }
  const code = requiredOpaque(input.code, "Código Meta", 20, 4096);
  const wabaId = requiredMetaId(input.wabaId, "WABA");
  const phoneNumberId = requiredMetaId(input.phoneNumberId, "Número do WhatsApp");
  const businessId = input.businessId ? requiredMetaId(input.businessId, "Business Portfolio") : null;
  const token = await exchangeCode(code);
  const phone = await verifyPhoneBelongsToWaba(token, wabaId, phoneNumberId);

  const db = getDatabase();
  const existing = await db.prepare(
    `SELECT id, restaurant_id, waba_id, business_id, phone_number_id, display_phone_number,
            verified_name, access_token_ciphertext, two_factor_pin_ciphertext, status
     FROM restaurant_whatsapp_connections WHERE restaurant_id = ? LIMIT 1`,
  ).bind(input.restaurantId).first<WhatsAppConnectionRow>();
  const otherOwner = await db.prepare(
    "SELECT restaurant_id FROM restaurant_whatsapp_connections WHERE phone_number_id = ? AND restaurant_id <> ? LIMIT 1",
  ).bind(phoneNumberId, input.restaurantId).first<{ restaurant_id: string }>();
  if (otherOwner) throw new HttpError(409, "Este número já está vinculado a outra loja Rapidex.", "whatsapp_phone_already_connected");
  if (existing?.status === "active" && existing.phone_number_id !== phoneNumberId) {
    throw new HttpError(409, "Desconecte o WhatsApp atual antes de conectar outro número.", "whatsapp_disconnect_required");
  }

  const samePhone = existing?.phone_number_id === phoneNumberId;
  let pin = randomSixDigitPin();
  if (samePhone && existing?.two_factor_pin_ciphertext) {
    try { pin = await decryptIntegrationSecret(existing.two_factor_pin_ciphertext); } catch { pin = randomSixDigitPin(); }
  }
  const encryptedToken = await encryptIntegrationSecret(token);
  const encryptedPin = await encryptIntegrationSecret(pin);
  const now = Date.now();
  const connectionId = existing?.id || crypto.randomUUID();

  if (!existing || existing.status !== "active") {
    if (existing) {
      await db.prepare(
        `UPDATE restaurant_whatsapp_connections SET waba_id = ?, business_id = ?, phone_number_id = ?,
         display_phone_number = ?, verified_name = ?, access_token_ciphertext = ?, two_factor_pin_ciphertext = ?,
         status = 'error', updated_at = ? WHERE id = ? AND restaurant_id = ?`,
      ).bind(
        wabaId, businessId, phoneNumberId, phone.display_phone_number || null, phone.verified_name || null,
        encryptedToken, encryptedPin, now, connectionId, input.restaurantId,
      ).run();
    } else {
      await db.prepare(
        `INSERT INTO restaurant_whatsapp_connections
         (id, restaurant_id, waba_id, business_id, phone_number_id, display_phone_number, verified_name,
          access_token_ciphertext, two_factor_pin_ciphertext, status, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'error', ?, ?)`,
      ).bind(
        connectionId, input.restaurantId, wabaId, businessId, phoneNumberId,
        phone.display_phone_number || null, phone.verified_name || null,
        encryptedToken, encryptedPin, now, now,
      ).run();
    }
  }

  await subscribeWaba(token, wabaId);
  await registerPhone(token, phoneNumberId, pin);

  const integration = await db.prepare(
    "SELECT id FROM integrations WHERE restaurant_id = ? AND provider = 'whatsapp' LIMIT 1",
  ).bind(input.restaurantId).first<{ id: string }>();
  const activateConnection = db.prepare(
    `UPDATE restaurant_whatsapp_connections SET waba_id = ?, business_id = ?, phone_number_id = ?,
     display_phone_number = ?, verified_name = ?, access_token_ciphertext = ?, two_factor_pin_ciphertext = ?,
     status = 'active', connected_at = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?`,
  ).bind(
    wabaId, businessId, phoneNumberId, phone.display_phone_number || null, phone.verified_name || null,
    encryptedToken, encryptedPin, now, now, connectionId, input.restaurantId,
  );
  const integrationStatement = integration
    ? db.prepare(
        `UPDATE integrations SET status = 'connected', external_account_id = ?, external_phone_id = ?,
         secret_ref = ?, settings_json = ?, last_error = NULL, connected_at = ?, updated_at = ? WHERE id = ?`,
      ).bind(
        wabaId, phoneNumberId, `restaurant_whatsapp_connections:${connectionId}`,
        JSON.stringify({ businessId, displayPhoneNumber: phone.display_phone_number || null, verifiedName: phone.verified_name || null }),
        now, now, integration.id,
      )
    : db.prepare(
        `INSERT INTO integrations
         (id, restaurant_id, provider, status, external_account_id, external_phone_id, secret_ref,
          settings_json, connected_at, created_at, updated_at)
         VALUES (?, ?, 'whatsapp', 'connected', ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), input.restaurantId, wabaId, phoneNumberId,
        `restaurant_whatsapp_connections:${connectionId}`,
        JSON.stringify({ businessId, displayPhoneNumber: phone.display_phone_number || null, verifiedName: phone.verified_name || null }),
        now, now, now,
      );
  await db.batch([activateConnection, integrationStatement]);

  return {
    wabaId,
    phoneNumberId,
    businessId,
    displayPhoneNumber: phone.display_phone_number || null,
    verifiedName: phone.verified_name || null,
  };
}

export async function disconnectRestaurantWhatsApp(restaurantId: string) {
  const db = getDatabase();
  const connection = await getRestaurantWhatsAppConnection(restaurantId);
  if (!connection) return { disconnected: false };

  const otherActive = await db.prepare(
    `SELECT id FROM restaurant_whatsapp_connections
     WHERE waba_id = ? AND restaurant_id <> ? AND status = 'active' LIMIT 1`,
  ).bind(connection.waba_id, restaurantId).first<{ id: string }>();

  if (!otherActive) {
    let token: string | null = null;
    try { token = await decryptIntegrationSecret(connection.access_token_ciphertext); } catch { token = null; }
    if (token) {
      try {
        await graphRequest(`/${connection.waba_id}/subscribed_apps`, token, { method: "DELETE" });
      } catch (error) {
        console.error("WhatsApp WABA unsubscribe failed", error instanceof Error ? error.message : "unknown");
      }
    }
  }

  const now = Date.now();
  await db.batch([
    db.prepare(
      `UPDATE restaurant_whatsapp_connections SET status = 'revoked', access_token_ciphertext = '',
       updated_at = ? WHERE restaurant_id = ?`,
    ).bind(now, restaurantId),
    db.prepare(
      `UPDATE integrations SET status = 'disabled', secret_ref = NULL, updated_at = ?
       WHERE restaurant_id = ? AND provider = 'whatsapp'`,
    ).bind(now, restaurantId),
  ]);
  return { disconnected: true, sharedWabaKeptSubscribed: Boolean(otherActive) };
}

async function exchangeCode(code: string) {
  const env = getBindings();
  const version = env.WHATSAPP_GRAPH_VERSION || "v25.0";
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set("client_id", env.RAPIDEX_META_APP_ID!);
  url.searchParams.set("client_secret", env.RAPIDEX_META_APP_SECRET!);
  url.searchParams.set("code", code);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({})) as MetaTokenPayload;
  if (!response.ok || !payload.access_token) {
    console.error("Meta Embedded Signup token exchange failed", response.status, payload.error?.message || "unknown");
    throw new HttpError(502, "A Meta não concluiu a autorização do WhatsApp.", "whatsapp_oauth_exchange_failed");
  }
  return payload.access_token;
}

async function verifyPhoneBelongsToWaba(token: string, wabaId: string, phoneNumberId: string) {
  const payload = await graphRequest<{ data?: MetaPhone[] }>(`/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, token);
  const phone = payload.data?.find((item) => item.id === phoneNumberId);
  if (!phone) throw new HttpError(409, "O número autorizado não pertence à conta WhatsApp selecionada.", "whatsapp_asset_mismatch");
  return phone;
}

async function subscribeWaba(token: string, wabaId: string) {
  await graphRequest(`/${wabaId}/subscribed_apps`, token, { method: "POST" });
}

async function registerPhone(token: string, phoneNumberId: string, pin: string) {
  await graphRequest(`/${phoneNumberId}/register`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

async function graphRequest<T = Record<string, unknown>>(path: string, token: string, init: RequestInit = {}) {
  const version = getBindings().WHATSAPP_GRAPH_VERSION || "v25.0";
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("accept", "application/json");
  const response = await fetch(`https://graph.facebook.com/${version}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) {
    console.error("Meta WhatsApp Graph request failed", response.status, payload.error?.message || "unknown");
    throw new HttpError(502, "A Meta não concluiu a configuração do WhatsApp.", "whatsapp_graph_error");
  }
  return payload;
}

function randomSixDigitPin() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (bytes[0] % 900000));
}
function requiredMetaId(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^\d{5,32}$/.test(text)) throw new HttpError(400, `${label} inválido.`, "validation_error");
  return text;
}
function requiredOpaque(value: unknown, label: string, min: number, max: number) {
  const text = String(value || "").trim();
  if (text.length < min || text.length > max) throw new HttpError(400, `${label} inválido.`, "validation_error");
  return text;
}
