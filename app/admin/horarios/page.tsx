import { requireChatGPTUser } from "@/app/chatgpt-auth";
import HoursClient from "./HoursClient";

export const dynamic = "force-dynamic";

export default async function AdminHoursPage() {
  await requireChatGPTUser("/admin/horarios");
  return <HoursClient />;
}
