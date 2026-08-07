import { requireChatGPTUser } from "@/app/chatgpt-auth";
import CategoriesClient from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireChatGPTUser("/admin/categorias");
  return <CategoriesClient />;
}
