import { constantTimeEqual } from "./security";

const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

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

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
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
