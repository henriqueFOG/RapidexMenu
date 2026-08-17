import assert from "node:assert/strict";
import test from "node:test";
import { hasPlatformPermission, type PlatformAdminRole, type PlatformPermission } from "../lib/platform-permissions";

const permissions: PlatformPermission[] = [
  "platform:read",
  "platform:operate",
  "restaurants:manage",
  "users:support",
  "admins:manage",
];

test("proprietário da plataforma possui todas as permissões administrativas", () => {
  for (const permission of permissions) assert.equal(hasPlatformPermission("owner", permission), true);
});

test("administrador opera a plataforma, mas não concede novos acessos internos", () => {
  assert.equal(hasPlatformPermission("admin", "platform:operate"), true);
  assert.equal(hasPlatformPermission("admin", "restaurants:manage"), true);
  assert.equal(hasPlatformPermission("admin", "users:support"), true);
  assert.equal(hasPlatformPermission("admin", "admins:manage"), false);
});

test("suporte só lê a plataforma e resolve acesso de usuários", () => {
  assert.equal(hasPlatformPermission("support", "platform:read"), true);
  assert.equal(hasPlatformPermission("support", "users:support"), true);
  assert.equal(hasPlatformPermission("support", "platform:operate"), false);
  assert.equal(hasPlatformPermission("support", "restaurants:manage"), false);
});

test("perfil de leitura não executa ações", () => {
  const role: PlatformAdminRole = "viewer";
  assert.equal(hasPlatformPermission(role, "platform:read"), true);
  for (const permission of permissions.filter((value) => value !== "platform:read")) {
    assert.equal(hasPlatformPermission(role, permission), false);
  }
});
