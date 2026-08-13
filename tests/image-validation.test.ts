import test from "node:test";
import assert from "node:assert/strict";
import { validateImageBytes } from "../lib/image-validation";

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeU32be(bytes, 16, width);
  writeU32be(bytes, 20, height);
  return bytes.buffer;
}

test("aceita PNG cuja assinatura e dimensões são compatíveis", () => {
  const result = validateImageBytes(png(1200, 800), "image/png");
  assert.equal(result.mime, "image/png");
  assert.equal(result.extension, "png");
  assert.equal(result.width, 1200);
  assert.equal(result.height, 800);
});

test("rejeita arquivo declarado como JPEG quando os bytes são PNG", () => {
  assert.throws(
    () => validateImageBytes(png(100, 100), "image/jpeg"),
    (error: unknown) => error instanceof Error && error.message.includes("tipo real"),
  );
});

test("rejeita dimensões excessivas mesmo com assinatura válida", () => {
  assert.throws(
    () => validateImageBytes(png(7000, 100), "image/png"),
    (error: unknown) => error instanceof Error && error.message.includes("grande demais"),
  );
});

test("rejeita conteúdo arbitrário disfarçado de imagem", () => {
  const bytes = new TextEncoder().encode("<html>not an image</html>").buffer;
  assert.throws(
    () => validateImageBytes(bytes, "image/png"),
    (error: unknown) => error instanceof Error && error.message.includes("não contém uma imagem"),
  );
});

function writeU32be(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
