import type { ReactNode } from "react";
import OrderAlerts from "./OrderAlerts";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}<OrderAlerts /></>;
}
