import { requireChatGPTUser } from "@/app/chatgpt-auth";
import KitchenDisplayClient from "./KitchenDisplayClient";

export const dynamic = "force-dynamic";

export default async function KitchenDisplayPage() {
  await requireChatGPTUser("/admin/cozinha");
  return <KitchenDisplayClient />;
}
