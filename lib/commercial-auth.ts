import { cookies } from "next/headers";
import { constantTimeEqual, hmacSha256Hex } from "./security";
import { getBindings, getDatabase } from "./runtime";

export const COMMERCIAL_SESSION_COOKIE = "rapidex_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

export type CommercialUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  authVersion: number;
};

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsRaw, saltHex, hashHex, ...extra] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || extra.length || !saltHex || !hashHex) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  const salt = fromHex(saltHex);
  if (!salt) return false;
  const derived = await derivePassword(password, salt, iterations);
  return constantTimeEqual(toHex(derived), hashHex.toLowerCase());
}

export function isNativeAuthMode() {
  return getBindings().RAPIDEX_AUTH_MODE === "native";
}

export function nativeAuthConfigured() {
  const secret = getBindings().RAPIDEX_SESSION_SECRET || "";
  return secret.length >= 32;
}

export function signupEnabled() {
  return getBindings().RAPIDEX_SIGNUP_ENABLED !== "false";
}

export async function createCommercialSessionToken(user: Pick<CommercialUser, "id" | "email" | "authVersion">) {
  const secret = requireSessionSecret();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const encodedEmail = base64UrlEncode(user.email.trim().toLowerCase());
  const payload = `v1.${user.id}.${user.authVersion}.${expiresAt}.${encodedEmail}`;
  const signature = await hmacSha256Hex(secret, payload);
  return { value: `${payload}.${signature}`, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

export async function setCommercialSession(user: Pick<CommercialUser, "id" | "email" | "authVersion">) {
  const session = await createCommercialSessionToken(user);
  (await cookies()).set(COMMERCIAL_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
}

export async function clearCommercialSession() {
  (await cookies()).set(COMMERCIAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCommercialUser(): Promise<CommercialUser | null> {
  if (!nativeAuthConfigured()) return null;
  const token = (await cookies()).get(COMMERCIAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = await verifyCommercialSessionToken(token);
  if (!parsed) return null;

  const row = await getDatabase()
    .prepare(
      `SELECT id, email, full_name, phone, auth_version
       FROM app_users WHERE id = ? AND lower(email) = ? AND status = 'active' LIMIT 1`,
    )
    .bind(parsed.userId, parsed.email)
    .first<{ id: string; email: string; full_name: string; phone: string | null; auth_version: number }>();
  if (!row || Number(row.auth_version) !== parsed.authVersion) return null;

  return {
    id: row.id,
    email: row.email.trim().toLowerCase(),
    fullName: row.full_name,
    phone: row.phone,
    authVersion: Number(row.auth_version),
  };
}

async function verifyCommercialSessionToken(token: string) {
  const [version, userId, authVersionRaw, expiresAtRaw, emailEncoded, signature, ...extra] = token.split(".");
  if (version !== "v1" || extra.length || !userId || !signature || !emailEncoded) return null;
  const authVersion = Number(authVersionRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(authVersion) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const email = base64UrlDecode(emailEncoded)?.trim().toLowerCase();
  if (!email) return null;
  const payload = `${version}.${userId}.${authVersionRaw}.${expiresAtRaw}.${emailEncoded}`;
  const expected = await hmacSha256Hex(requireSessionSecret(), payload);
  if (!constantTimeEqual(expected, signature.toLowerCase())) return null;
  return { userId, authVersion, expiresAt, email };
}

function requireSessionSecret() {
  const secret = getBindings().RAPIDEX_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("Configure RAPIDEX_SESSION_SECRET com pelo menos 32 caracteres.");
  return secret;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function base64UrlEncode(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}
