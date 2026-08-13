import { requireChatGPTUser } from "@/app/chatgpt-auth";
import PrivacyClient from "./PrivacyClient";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  await requireChatGPTUser("/admin/privacidade");
  return <PrivacyClient />;
}
