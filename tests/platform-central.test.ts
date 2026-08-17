import assert from "node:assert/strict";
import test from "node:test";
import { restaurantControlTransition, slugifyManagedRestaurant } from "../lib/platform-central";

test("bloqueio preserva estado anterior e desbloqueio o restaura", () => {
  const blocked = restaurantControlTransition({ status: "trial", blockedAt: null, previousStatus: null }, "block", 100);
  assert.deepEqual(blocked, { status: "paused", blockedAt: 100, previousStatus: "trial" });
  assert.deepEqual(
    restaurantControlTransition({ status: blocked.status, blockedAt: blocked.blockedAt, previousStatus: blocked.previousStatus }, "unblock", 200),
    { status: "trial", blockedAt: null, previousStatus: null },
  );
});

test("loja bloqueada não pode ser reativada sem desbloqueio explícito", () => {
  assert.throws(
    () => restaurantControlTransition({ status: "paused", blockedAt: 100, previousStatus: "active" }, "reactivate", 200),
    /Desbloqueie/,
  );
});

test("slug administrativo é previsível e seguro", () => {
  assert.equal(slugifyManagedRestaurant("Heloísa Gall — Restaurante"), "heloisa-gall-restaurante");
});
