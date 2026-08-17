import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPlatformAdminEmailAllowed,
  assertCanonicalOwnerNotRemoved,
  assertPlatformOwnerRoleAllowed,
  CANONICAL_PLATFORM_OWNER_EMAIL,
  configuredPlatformOwnerIsCanonical,
} from "../lib/platform-identity-policy";

test("Henry permanece o proprietário canônico da plataforma", () => {
  assert.equal(CANONICAL_PLATFORM_OWNER_EMAIL, "henry.francisco31@hotmail.com");
  assert.equal(configuredPlatformOwnerIsCanonical("HENRY.FRANCISCO31@HOTMAIL.COM"), true);
  assert.equal(configuredPlatformOwnerIsCanonical("heloisa.gall@gmail.com"), false);
});

test("e-mail da Heloisa é permitido para loja, mas recusado como superadmin", () => {
  assert.throws(() => assertPlatformAdminEmailAllowed("heloisa.gall@gmail.com"), /não pode ser usado na administração geral/);
  assert.equal(assertPlatformAdminEmailAllowed("novo.admin@example.com"), "novo.admin@example.com");
});

test("somente Henry pode manter o papel de proprietário da plataforma", () => {
  assert.equal(assertPlatformOwnerRoleAllowed(CANONICAL_PLATFORM_OWNER_EMAIL, "owner"), "owner");
  assert.equal(assertPlatformOwnerRoleAllowed("outro.admin@example.com", "admin"), "admin");
  assert.throws(() => assertPlatformOwnerRoleAllowed("outro.admin@example.com", "owner"), /reservado ao titular canônico/);
  assert.throws(() => assertCanonicalOwnerNotRemoved(CANONICAL_PLATFORM_OWNER_EMAIL, "admin", "active"), /não pode ser rebaixado/);
  assert.throws(() => assertCanonicalOwnerNotRemoved(CANONICAL_PLATFORM_OWNER_EMAIL, "owner", "revoked"), /não pode ser rebaixado/);
});
