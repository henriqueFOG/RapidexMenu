import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  return (
    <AdminClient
      initialUser={{ name: user.displayName, email: user.email }}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
}
