import assert from "node:assert/strict";
import test from "node:test";
import { addressComplete, explicitWhatsAppConfirmation, inferDraftStage } from "../lib/whatsapp-order-draft";

const address = {
  street: "Rua do Imperador",
  number: "100",
  neighborhood: "Centro",
  city: "Petrópolis",
  state: "RJ",
  postalCode: "25620000",
  complement: "",
};
const items = [{ productId: "burger", quantity: 1, notes: "" }];

test("WhatsApp order requires items before checkout", () => {
  assert.equal(inferDraftStage([], address, "cash"), "collecting");
});

test("WhatsApp order requires a complete address", () => {
  assert.equal(inferDraftStage(items, { ...address, postalCode: "" }, "cash"), "awaiting_address");
  assert.equal(addressComplete(address), true);
});

test("WhatsApp order requires payment before confirmation", () => {
  assert.equal(inferDraftStage(items, address, null), "awaiting_payment");
  assert.equal(inferDraftStage(items, address, "card_on_delivery"), "awaiting_confirmation");
});

test("only explicit confirmations pass deterministic gate", () => {
  assert.equal(explicitWhatsAppConfirmation("CONFIRMO"), true);
  assert.equal(explicitWhatsAppConfirmation("sim"), true);
  assert.equal(explicitWhatsAppConfirmation("talvez"), false);
  assert.equal(explicitWhatsAppConfirmation("não confirma ainda"), false);
});
