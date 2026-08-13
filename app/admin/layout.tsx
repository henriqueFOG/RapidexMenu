import type { ReactNode } from "react";
import InstallPwaPrompt from "./InstallPwaPrompt";
import OrderAlerts from "./OrderAlerts";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}<OrderAlerts /><InstallPwaPrompt /></>;
}
