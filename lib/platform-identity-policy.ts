import { HttpError } from "./http";

export const CANONICAL_PLATFORM_OWNER_EMAIL = "henry.francisco31@hotmail.com";
export const FORBIDDEN_PLATFORM_ADMIN_EMAIL = "heloisa.gall@gmail.com";
const FORBIDDEN_PLATFORM_ADMIN_EMAILS = new Set([FORBIDDEN_PLATFORM_ADMIN_EMAIL]);

export function assertPlatformAdminEmailAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  if (FORBIDDEN_PLATFORM_ADMIN_EMAILS.has(normalized)) {
    throw new HttpError(
      400,
      "Este e-mail não pode ser usado na administração geral. Ele continua permitido para contas de estabelecimento.",
      "platform_admin_email_forbidden",
    );
  }
  return normalized;
}

export function configuredPlatformOwnerIsCanonical(value: unknown) {
  return String(value || "").trim().toLowerCase() === CANONICAL_PLATFORM_OWNER_EMAIL;
}

export function assertPlatformOwnerRoleAllowed(email: string, role: string) {
  const normalized = email.trim().toLowerCase();
  if (role === "owner" && normalized !== CANONICAL_PLATFORM_OWNER_EMAIL) {
    throw new HttpError(
      400,
      "O perfil de proprietário da plataforma permanece reservado ao titular canônico. Conceda admin, suporte ou leitura.",
      "platform_owner_role_reserved",
    );
  }
  return role;
}

export function assertCanonicalOwnerNotRemoved(email: string, role: string, status: string) {
  if (email.trim().toLowerCase() === CANONICAL_PLATFORM_OWNER_EMAIL && (role !== "owner" || status !== "active")) {
    throw new HttpError(
      409,
      "O proprietário canônico não pode ser rebaixado, revogado ou bloqueado pela Central.",
      "canonical_platform_owner_protected",
    );
  }
}
