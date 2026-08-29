import { hashPassword } from "../lib/password-hash";
import { CANONICAL_PLATFORM_OWNER_EMAIL } from "../lib/platform-identity-policy";
import { getPostgresDatabase } from "../lib/postgres-d1";

const environment = String(process.env.RAPIDEX_ENV || "").trim().toLowerCase();
if (environment !== "hmg" && environment !== "ci") {
  throw new Error("O seed de superadmin E2E só pode rodar em HMG/CI descartável.");
}
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o seed E2E.");
const password = String(process.env.RAPIDEX_PLATFORM_E2E_PASSWORD || "");
if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  throw new Error("RAPIDEX_PLATFORM_E2E_PASSWORD deve ter 10+ caracteres, letra e número.");
}

const db = getPostgresDatabase(connectionString);
const now = Date.now();
const passwordHash = await hashPassword(password);
const existingUser = await db.prepare(
  "SELECT id FROM app_users WHERE lower(email) = lower(?) LIMIT 1",
).bind(CANONICAL_PLATFORM_OWNER_EMAIL).first<{ id: string }>();

let userId = existingUser?.id || null;
if (userId) {
  await db.prepare(
    `UPDATE app_users
     SET email = ?, password_hash = ?, full_name = 'Henry Francisco', status = 'active',
         auth_version = auth_version + 1, updated_at = ?
     WHERE id = ?`,
  ).bind(CANONICAL_PLATFORM_OWNER_EMAIL, passwordHash, now, userId).run();
} else {
  userId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO app_users
     (id, email, password_hash, full_name, phone, status, auth_version, created_at, updated_at)
     VALUES (?, ?, ?, 'Henry Francisco', NULL, 'active', 1, ?, ?)`,
  ).bind(userId, CANONICAL_PLATFORM_OWNER_EMAIL, passwordHash, now, now).run();
}

const user = await db.prepare(
  "SELECT id FROM app_users WHERE lower(email) = lower(?) LIMIT 1",
).bind(CANONICAL_PLATFORM_OWNER_EMAIL).first<{ id: string }>();
if (!user || user.id !== userId) throw new Error("Não foi possível preparar a identidade E2E.");

await db.prepare(
  `INSERT INTO platform_admins
   (id, user_id, role, status, created_by_user_id, created_at, updated_at)
   VALUES (?, ?, 'owner', 'active', ?, ?, ?)
   ON CONFLICT (user_id) DO UPDATE SET role = 'owner', status = 'active', updated_at = excluded.updated_at`,
).bind(crypto.randomUUID(), user.id, user.id, now, now).run();

process.stdout.write("Superadmin canônico preparado no banco E2E descartável.\n");
