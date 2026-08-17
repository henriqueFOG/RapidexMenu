export type PlatformAdminRole = "owner" | "admin" | "support" | "viewer";
export type PlatformPermission =
  | "platform:read"
  | "platform:operate"
  | "restaurants:manage"
  | "users:support"
  | "admins:manage";

const ROLE_PERMISSIONS: Record<PlatformAdminRole, readonly PlatformPermission[]> = {
  owner: ["platform:read", "platform:operate", "restaurants:manage", "users:support", "admins:manage"],
  admin: ["platform:read", "platform:operate", "restaurants:manage", "users:support"],
  support: ["platform:read", "users:support"],
  viewer: ["platform:read"],
};

export function hasPlatformPermission(role: PlatformAdminRole, permission: PlatformPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
