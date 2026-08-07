import { apiError, assertSameOrigin, HttpError, json, readJson } from "@/lib/http";
import { hashPassword, isNativeAuthMode, nativeAuthConfigured, setCommercialSession, signupEnabled } from "@/lib/commercial-auth";
import { consumeRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getDatabase } from "@/lib/runtime";
import { normalizePhone, optionalString, requiredString } from "@/lib/validation";

export const dynamic = "force-dynamic";

type SignupBody = {
  ownerName?: unknown;
  email?: unknown;
  password?: unknown;
  phone?: unknown;
  restaurantName?: unknown;
  slug?: unknown;
  city?: unknown;
  state?: unknown;
  whatsapp?: unknown;
  plan?: unknown;
  termsAccepted?: unknown;
  privacyAccepted?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!isNativeAuthMode() || !nativeAuthConfigured() || !signupEnabled()) {
      throw new HttpError(503, "O cadastro comercial ainda não está habilitado neste ambiente.", "signup_unavailable");
    }
    assertSameOrigin(request);
    const db = getDatabase();
    const limit = await consumeRateLimit(db, await rateLimitKey(request, "signup"), 5, 60 * 60 * 1000);
    if (!limit.allowed) throw new HttpError(429, "Muitas tentativas de cadastro. Tente novamente mais tarde.", "rate_limited");

    const body = await readJson<SignupBody>(request, 40_000);
    const ownerName = requiredString(body.ownerName, "Seu nome", 2, 120);
    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);
    const phone = normalizePhone(body.phone);
    const restaurantName = requiredString(body.restaurantName, "Nome do restaurante", 2, 120);
    const city = requiredString(body.city, "Cidade", 2, 100);
    const state = normalizeState(body.state);
    const whatsapp = body.whatsapp ? normalizePhone(body.whatsapp) : phone;
    const plan = normalizePlan(body.plan);
    if (body.termsAccepted !== true || body.privacyAccepted !== true) {
      throw new HttpError(400, "Aceite os Termos de Uso e a Política de Privacidade para continuar.", "consent_required");
    }

    const existingUser = await db.prepare("SELECT id FROM app_users WHERE lower(email) = ? LIMIT 1").bind(email).first();
    if (existingUser) throw new HttpError(409, "Já existe uma conta com este e-mail. Entre na sua conta.", "account_exists");

    const requestedSlug = optionalString(body.slug, "Endereço da loja", 80);
    const slug = await uniqueSlug(db, requestedSlug ? slugify(requestedSlug) : slugify(restaurantName));
    const now = Date.now();
    const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000;
    const userId = crypto.randomUUID();
    const restaurantId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const categoryId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const settingsJson = JSON.stringify({ cuisine: "Restaurante", brandColor: "#ff650b" });

    await db.batch([
      db.prepare(
        `INSERT INTO app_users (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      ).bind(userId, email, passwordHash, ownerName, phone, now, now),
      db.prepare(
        `INSERT INTO restaurants
         (id, slug, name, owner_email, plan, status, phone, whatsapp, city, state, is_open, settings_json,
          trial_ends_at, onboarding_completed, terms_accepted_at, privacy_accepted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'trial', ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?)`,
      ).bind(
        restaurantId, slug, restaurantName, email, plan, phone, whatsapp, city, state, settingsJson,
        trialEndsAt, now, now, now, now,
      ),
      db.prepare(
        `INSERT INTO members (id, restaurant_id, email, name, role, active, created_at)
         VALUES (?, ?, ?, ?, 'owner', 1, ?)`,
      ).bind(memberId, restaurantId, email, ownerName, now),
      db.prepare(
        `INSERT INTO categories (id, restaurant_id, name, position, active, created_at, updated_at)
         VALUES (?, ?, 'Principais', 0, 1, ?, ?)`,
      ).bind(categoryId, restaurantId, now, now),
    ]);

    await setCommercialSession({ id: userId, email, authVersion: 1 });
    return json({
      ok: true,
      next: "/onboarding",
      trialEndsAt,
      restaurant: { id: restaurantId, name: restaurantName, slug, plan },
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function normalizeEmail(value: unknown) {
  const email = requiredString(value, "E-mail", 5, 160).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "E-mail inválido.", "validation_error", { field: "email" });
  }
  return email;
}

function validatePassword(value: unknown) {
  const password = requiredString(value, "Senha", 10, 128);
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, "A senha deve ter pelo menos 10 caracteres, incluindo letra e número.", "validation_error", { field: "password" });
  }
  return password;
}

function normalizeState(value: unknown) {
  const state = requiredString(value, "Estado", 2, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new HttpError(400, "Use a sigla do estado com 2 letras.", "validation_error", { field: "state" });
  return state;
}

function normalizePlan(value: unknown): "start" | "growth" | "scale" {
  if (value === "growth" || value === "scale") return value;
  return "start";
}

function slugify(value: string) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  if (slug.length >= 2) return slug;
  return `loja-${crypto.randomUUID().slice(0, 8)}`;
}

async function uniqueSlug(db: D1Database, base: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const row = await db.prepare("SELECT id FROM restaurants WHERE slug = ? LIMIT 1").bind(candidate).first();
    if (!row) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
