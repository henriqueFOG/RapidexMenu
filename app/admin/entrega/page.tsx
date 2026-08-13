import { requireChatGPTUser } from "@/app/chatgpt-auth";
import DeliveryZonesClient from "./DeliveryZonesClient";

export const dynamic = "force-dynamic";

export default async function DeliveryZonesPage() {
  await requireChatGPTUser("/admin/entrega");
  return <DeliveryZonesClient />;
}
