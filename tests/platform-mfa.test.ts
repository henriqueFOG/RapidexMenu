import assert from "node:assert/strict";
import test from "node:test";
import { totpCodeAt } from "../lib/totp";

test("TOTP segue o vetor RFC 6238", async () => {
  assert.equal(await totpCodeAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 8), "94287082");
  assert.equal(await totpCodeAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1_111_111_109_000, 8), "07081804");
});
