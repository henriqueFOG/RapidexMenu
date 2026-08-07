import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { whatsappEmbeddedSignupPublicConfig } from "@/lib/whatsapp-connection";
import WhatsAppConnectClient from "./WhatsAppConnectClient";

export const dynamic = "force-dynamic";

export default async function AdminWhatsAppPage() {
  await requireChatGPTUser("/admin/whatsapp");
  return <WhatsAppConnectClient config={whatsappEmbeddedSignupPublicConfig()} />;
}
