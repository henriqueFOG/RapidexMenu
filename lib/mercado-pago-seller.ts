import { HttpError } from "./http";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-secrets";
import { getBindings, getDatabase } from "./runtime";
import { constantTimeEqual, hmacSha256Hex } from "./security";

const STATE_MINUTES = 15;

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  scope?: string;
  token_type?: string;
  message?: string;
};

type ConnectionRow = {
  id: string;
  restaurant_id: string;
  provider_account_id: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: number | null;
  status: string;
  scopes: string | null;
};

export function sellerMercadoPagoConfigured() {
  const env = getBindings();
  return Boolean(
    env.RAPIDEX_MP_CLIENT_ID &&
      env.RAPIDEX_MP_CLIENT_SECRET &&
      env.RAPIDEX_INTEGRATION_SECRET &&
      env.RAPIDEX_INTEGRATION_SECRET.length >= 32,
  );
}

export async function createSellerAuthorizationUrl(restaurantId: string, origin: string) {
  const env = getBindings();
  if (!sellerMercadoPagoConfigured() || !env.RAPIDEX_MP_CLIENT_ID) {
    throw new HttpError(503, "A conexão Mercado Pago ainda não está habilitada.", "integration_not_configured");
  }
  const redirectUri = `${env.RAPIDEX_PUBLIC_URL || origin}/api/integrations/mercado-pago/callback`;
  const state = await createOAuthState(restaurantId);
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", env.RAPIDEX_MP_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export async function completeSellerAuthorization(input: { code: string; state: string; origin: string }) {
  const restaurantId = await verifyOAuthState(input.state);
  if (!restaurantId) throw new HttpError(400, "Autorização expirada ou inválida.", "oauth_state_invalid");
  const env = getBindings();
  if (!env.RAPIDEX_MP_CLIENT_ID || !env.RAPIDEX_MP_CLIENT_SECRET) {
    throw new HttpError(503, "A conexão Mercado Pago ainda não está habilitada.", "integration_not_configured");
  }
  const redirectUri = `${env.RAPIDEX_PUBLIC_URL || input.origin}/api/integrations/mercado-pago/callback`;
  const token = await exchangeToken({
    client_id: env.RAPIDEX_MP_CLIENT_ID,
    client_secret: env.RAPIDEX_MP_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: redirectUri,
  });
  if (!token.access_token) throw new HttpError(502, "Mercado Pago não retornou uma autorização válida.", "oauth_exchange_failed");

  const now = Date.now();
  const access = await encryptIntegrationSecret(token.access_token);
  const refresh = token.refresh_token ? await encryptIntegrationSecret(token.refresh_token) : null;
  const expiresAt = token.expires_in ? now + Math.max(60, Number(token.expires_in)) * 1000 : null;
  const db = getDatabase();
  const existing = await db.prepare(
    "SELECT id FROM restaurant_payment_connections WHERE restaurant_id = ? AND provider = 'mercado_pago' LIMIT 1",
  ).bind(restaurantId).first<{ id: string }>();
  if (existing) {
    await db.prepare(
      `UPDATE restaurant_payment_connections SET provider_account_id = ?, access_token_ciphertext = ?,
       refresh_token_ciphertext = ?, token_expires_at = ?, status = 'active', scopes = ?, connected_at = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(String(token.user_id || ""), access, refresh, expiresAt, token.scope || null, now, now, existing.id).run();
  } else {
    await db.prepare(
      `INSERT INTO restaurant_payment_connections
       (id, restaurant_id, provider, provider_account_id, access_token_ciphertext, refresh_token_ciphertext,
        token_expires_at, status, scopes, connected_at, updated_at)
       VALUES (?, ?, 'mercado_pago', ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), restaurantId, String(token.user_id || ""), access, refresh, expiresAt, token.scope || null, now, now).run();
  }
  return restaurantId;
}

export async function getSellerPaymentConnection(restaurantId: string) {
  const row = await getDatabase().prepare(
    `SELECT id, restaurant_id, provider_account_id, access_token_ciphertext, refresh_token_ciphertext,
            token_expires_at, status, scopes
     FROM restaurant_payment_connections
     WHERE restaurant_id = ? AND provider = 'mercado_pago' LIMIT 1`,
  ).bind(restaurantId).first<ConnectionRow>();
  return row && row.status === "active" ? row : null;
}

export async function sellerPixAvailable(restaurantId: string) {
  return Boolean(sellerMercadoPagoConfigured() && await getSellerPaymentConnection(restaurantId));
}

export async function getSellerAccessToken(restaurantId: string) {
  const row = await getSellerPaymentConnection(restaurantId);
  if (!row) return null;
  const now = Date.now();
  if (!row.token_expires_at || row.token_expires_at > now + 5 * 60_000) {
    return decryptIntegrationSecret(row.access_token_ciphertext);
  }
  if (!row.refresh_token_ciphertext) {
    await markConnection(row.id, "expired");
    return null;
  }
  const env = getBindings();
  if (!env.RAPIDEX_MP_CLIENT_ID || !env.RAPIDEX_MP_CLIENT_SECRET) return null;
  try {
    const refreshToken = await decryptIntegrationSecret(row.refresh_token_ciphertext);
    const token = await exchangeToken({
      client_id: env.RAPIDEX_MP_CLIENT_ID,
      client_secret: env.RAPIDEX_MP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (!token.access_token) throw new Error("missing access token");
    const access = await encryptIntegrationSecret(token.access_token);
    const refresh = token.refresh_token ? await encryptIntegrationSecret(token.refresh_token) : row.refresh_token_ciphertext;
    const expiresAt = token.expires_in ? now + Math.max(60, Number(token.expires_in)) * 1000 : null;
    await getDatabase().prepare(
      `UPDATE restaurant_payment_connections SET access_token_ciphertext = ?, refresh_token_ciphertext = ?,
       token_expires_at = ?, status = 'active', scopes = COALESCE(?, scopes), updated_at = ? WHERE id = ?`,
    ).bind(access, refresh, expiresAt, token.scope || null, now, row.id).run();
    return token.access_token;
  } catch (error) {
    console.error("Mercado Pago seller token refresh failed", error instanceof Error ? error.message : "unknown");
    await markConnection(row.id, "error");
    return null;
  }
}

export async function disconnectSellerMercadoPago(restaurantId: string) {
  await getDatabase().prepare(
    `UPDATE restaurant_payment_connections SET status = 'revoked', access_token_ciphertext = '',
     refresh_token_ciphertext = NULL, updated_at = ? WHERE restaurant_id = ? AND provider = 'mercado_pago'`,
  ).bind(Date.now(), restaurantId).run();
}

async function exchangeToken(body: Record<string, string>) {
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as TokenPayload;
  if (!response.ok) {
    console.error("Mercado Pago OAuth failed", response.status, payload.message || "unknown");
    throw new HttpError(502, "Não foi possível conectar a conta Mercado Pago.", "oauth_exchange_failed");
  }
  return payload;
}

async function createOAuthState(restaurantId: string) {
  const secret = stateSecret();
  const expiresAt = Date.now() + STATE_MINUTES * 60_000;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const payload = `v1.${restaurantId}.${expiresAt}.${nonce}`;
  const signature = await hmacSha256Hex(secret, payload);
  return `${payload}.${signature}`;
}

async function verifyOAuthState(value: string) {
  const [version, restaurantId, expiresRaw, nonce, signature, ...extra] = value.split(".");
  const expiresAt = Number(expiresRaw);
  if (version !== "v1" || extra.length || !restaurantId || !nonce || !signature || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const payload = `${version}.${restaurantId}.${expiresRaw}.${nonce}`;
  const expected = await hmacSha256Hex(stateSecret(), payload);
  return constantTimeEqual(expected, signature) ? restaurantId : null;
}

function stateSecret() {
  const secret = getBindings().RAPIDEX_INTEGRATION_SECRET || getBindings().RAPIDEX_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("Configure um segredo de integração forte.");
  return secret;
}

async function markConnection(id: string, status: "expired" | "error") {
  await getDatabase().prepare("UPDATE restaurant_payment_connections SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, Date.now(), id).run();
}
