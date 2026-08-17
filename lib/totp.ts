import { constantTimeEqual } from "./security";

export function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  for (const drift of [-1, 0, 1]) {
    const expected = await totpCodeAt(secret, now + drift * 30_000);
    if (constantTimeEqual(expected, code)) return true;
  }
  return false;
}

export async function totpCodeAt(secret: string, now: number, digits = 6) {
  const counter = Math.floor(now / 30_000);
  const counterBytes = new Uint8Array(8);
  let remaining = counter;
  for (let index = 7; index >= 0; index -= 1) {
    counterBytes[index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, "0");
}

function base32Encode(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Segredo TOTP inválido.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(output);
}
