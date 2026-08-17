import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getPlatformAdmin } from "@/lib/platform-admin";
import PlatformConsoleClient from "@/app/admin/plataforma/PlatformConsoleClient";

export const dynamic = "force-dynamic";

export default async function CentralPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/central/entrar");
  const admin = await getPlatformAdmin(user);
  if (!admin) redirect("/central/entrar?erro=acesso-restrito");
  return <PlatformConsoleClient currentAdmin={{ name: admin.displayName, email: admin.email, role: admin.role }} />;
}
