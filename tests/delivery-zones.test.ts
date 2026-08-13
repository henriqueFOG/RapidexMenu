import test from "node:test";
import assert from "node:assert/strict";
import { matchDeliveryTerms, type DeliveryZoneRow } from "../lib/delivery-zones";

const zones: DeliveryZoneRow[] = [
  { id: "bairro", name: "Centro", match_type: "neighborhood", match_value: "Centro", fee_cents: 600, minimum_order_cents: 2500, extra_minutes: 5 },
  { id: "cep-5", name: "CEP 25640", match_type: "postal_prefix", match_value: "25640", fee_cents: 800, minimum_order_cents: 3000, extra_minutes: 10 },
  { id: "cep-8", name: "Rua especial", match_type: "postal_prefix", match_value: "25640123", fee_cents: 300, minimum_order_cents: 1500, extra_minutes: 2 },
];

test("CEP mais específico vence CEP genérico e bairro", () => {
  const result = matchDeliveryTerms(zones, {
    settingsValue: { delivery: { restrictToZones: true } },
    address: { postalCode: "25640-123", neighborhood: "Centro" },
    defaultFeeCents: 999,
    defaultMinimumOrderCents: 9999,
  });
  assert.equal(result.zoneId, "cep-8");
  assert.equal(result.feeCents, 300);
  assert.equal(result.minimumOrderCents, 1500);
  assert.equal(result.extraMinutes, 2);
});

test("prefixo de CEP vence bairro quando ambos combinam", () => {
  const result = matchDeliveryTerms(zones, {
    settingsValue: { delivery: { restrictToZones: true } },
    address: { postalCode: "25640-999", neighborhood: "Centro" },
    defaultFeeCents: 0,
    defaultMinimumOrderCents: 0,
  });
  assert.equal(result.zoneId, "cep-5");
  assert.equal(result.feeCents, 800);
});

test("bairro é normalizado sem acento e caixa", () => {
  const result = matchDeliveryTerms([
    { id: "bairro", name: "São José", match_type: "neighborhood", match_value: "São José", fee_cents: 500, minimum_order_cents: 0, extra_minutes: 0 },
  ], {
    settingsValue: {},
    address: { postalCode: "00000000", neighborhood: "sao jose" },
    defaultFeeCents: 900,
    defaultMinimumOrderCents: 1000,
  });
  assert.equal(result.zoneId, "bairro");
});

test("fora da zona usa defaults quando cobertura não é restrita", () => {
  const result = matchDeliveryTerms(zones, {
    settingsValue: { delivery: { restrictToZones: false } },
    address: { postalCode: "20000000", neighborhood: "Outro" },
    defaultFeeCents: 700,
    defaultMinimumOrderCents: 2200,
  });
  assert.equal(result.matched, false);
  assert.equal(result.feeCents, 700);
  assert.equal(result.minimumOrderCents, 2200);
});

test("fora da zona é bloqueado quando cobertura é restrita", () => {
  assert.throws(
    () => matchDeliveryTerms(zones, {
      settingsValue: { delivery: { restrictToZones: true } },
      address: { postalCode: "20000000", neighborhood: "Outro" },
      defaultFeeCents: 0,
      defaultMinimumOrderCents: 0,
    }),
    (error: unknown) => error instanceof Error && error.message.includes("fora da área"),
  );
});
