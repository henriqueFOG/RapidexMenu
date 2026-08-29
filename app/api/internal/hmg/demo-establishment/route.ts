import { ensureDemoData, DEMO_RESTAURANT_ID, DEMO_RESTAURANT_SLUG } from "@/lib/demo-data";
import { json } from "@/lib/http";
import { getDatabase, getRapidexEnvironment } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "estabelecimento.demo@rapidex-hmg.test";
const DEMO_PASSWORD_HASH = "pbkdf2_sha256$210000$3815c3f06a270b6f59db285eecd14746$9cf2389935d4432e7bcf81c458eab5f024785e400d912991d7cbbbf3060cea8f";
const DEMO_USER_ID = "user_hmg_demo_establishment";
const DEMO_MEMBER_ID = "member_hmg_demo_establishment";

export async function GET() {
  if (getRapidexEnvironment() !== "hmg") {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const db = getDatabase();
  await ensureDemoData(db);
  const now = Date.now();
  const trialEndsAt = now + 30 * 24 * 60 * 60 * 1000;

  const existingUser = await db.prepare(
    "SELECT id FROM app_users WHERE lower(email) = ? LIMIT 1",
  ).bind(DEMO_EMAIL).first<{ id: string }>();
  const userId = existingUser?.id || DEMO_USER_ID;

  // A senha inicial só é gravada no primeiro provisionamento. Chamadas futuras
  // nunca redefinem credenciais nem invalidam a sessão do usuário de demonstração.
  if (!existingUser) {
    await db.prepare(
      `INSERT INTO app_users
       (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
    ).bind(userId, DEMO_EMAIL, DEMO_PASSWORD_HASH, "Gestor Demo Rapidex", "24999990000", now, now).run();
  }

  await db.batch([
    db.prepare(
      `UPDATE restaurants
       SET owner_email = ?, plan = 'growth', status = 'trial', trial_ends_at = COALESCE(trial_ends_at, ?),
           access_ends_at = NULL, onboarding_completed = 1, published_at = COALESCE(published_at, ?),
           is_open = 1, updated_at = ?
       WHERE id = ?`,
    ).bind(DEMO_EMAIL, trialEndsAt, now, now, DEMO_RESTAURANT_ID),
    db.prepare(
      `INSERT INTO members (id, restaurant_id, email, name, role, active, created_at)
       VALUES (?, ?, ?, ?, 'owner', 1, ?)
       ON CONFLICT (restaurant_id, email) DO UPDATE SET name = EXCLUDED.name, role = 'owner', active = 1`,
    ).bind(DEMO_MEMBER_ID, DEMO_RESTAURANT_ID, DEMO_EMAIL, "Gestor Demo Rapidex", now),
  ]);

  const restaurant = await db.prepare(
    `SELECT id, name, slug, plan, status, onboarding_completed, is_open
     FROM restaurants WHERE id = ? LIMIT 1`,
  ).bind(DEMO_RESTAURANT_ID).first<Record<string, unknown>>();
  const catalog = await db.prepare(
    "SELECT COUNT(*) AS total FROM products WHERE restaurant_id = ? AND active = 1",
  ).bind(DEMO_RESTAURANT_ID).first<{ total: number }>();
  const orders = await db.prepare(
    "SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ?",
  ).bind(DEMO_RESTAURANT_ID).first<{ total: number }>();

  return json({
    ok: true,
    demo: {
      email: DEMO_EMAIL,
      provisionedNow: !existingUser,
      restaurant,
      products: Number(catalog?.total || 0),
      orders: Number(orders?.total || 0),
      loginPath: "/entrar",
      adminPath: "/admin",
      storefrontPath: `/loja/${DEMO_RESTAURANT_SLUG}`,
    },
  });
}
