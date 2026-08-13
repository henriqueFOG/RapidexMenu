import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFulfillmentEnabled,
  fulfillmentSettingsFrom,
  normalizeFulfillmentSettings,
} from "../lib/fulfillment";


test("lojas legadas continuam delivery-only por padrão", () => {
  assert.deepEqual(fulfillmentSettingsFrom({}), {
    deliveryEnabled: true,
    pickupEnabled: false,
    dineInEnabled: false,
  });
});


test("restaurante pode habilitar retirada e mesa explicitamente", () => {
  const settings = normalizeFulfillmentSettings({
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
  });
  assert.equal(settings.pickupEnabled, true);
  assert.equal(settings.dineInEnabled, true);
  assert.doesNotThrow(() => assertFulfillmentEnabled({ fulfillment: settings }, "pickup"));
  assert.doesNotThrow(() => assertFulfillmentEnabled({ fulfillment: settings }, "dine_in"));
});


test("não permite desligar todas as modalidades", () => {
  assert.throws(
    () => normalizeFulfillmentSettings({
      deliveryEnabled: false,
      pickupEnabled: false,
      dineInEnabled: false,
    }),
    (error: unknown) => error instanceof Error && error.message.includes("pelo menos uma modalidade"),
  );
});


test("checkout bloqueia modalidade não habilitada", () => {
  assert.throws(
    () => assertFulfillmentEnabled({ fulfillment: { deliveryEnabled: true, pickupEnabled: false, dineInEnabled: false } }, "pickup"),
    (error: unknown) => error instanceof Error && error.message.includes("não está disponível"),
  );
});
