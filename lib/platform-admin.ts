import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { HttpError } from "./http";
import { getBindings } from "./runtime";

export async function requirePlatformAdmin(): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "Entre para acessar a plataforma.", "authentication_required");
  const ownerEmail = getBindings().RAPIDEX_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    throw new HttpError(503, "Administrador da plataforma ainda não configurado.", "platform_admin_not_configured");
  }
  if (user.email.trim().toLowerCase() !== ownerEmail) {
    throw new HttpError(403, "Acesso restrito à administração da plataforma.", "platform_admin_required");
  }
  return user;
}
