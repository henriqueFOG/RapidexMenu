import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/password-hash";

test("hash de senha usa sal aleatório e valida somente a senha correta", async () => {
  const first = await hashPassword("RapidexSenha123");
  const second = await hashPassword("RapidexSenha123");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("RapidexSenha123", first), true);
  assert.equal(await verifyPassword("senha-incorreta", first), false);
});
