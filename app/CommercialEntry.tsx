"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CommercialEntry({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled || pathname !== "/") return null;
  return <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, alignItems: "center" }}>
    <Link href="/entrar" style={{ background: "#fff", color: "#171915", border: "1px solid #dfe3d7", borderRadius: 999, padding: "11px 15px", fontSize: 13, fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.09)" }}>Entrar</Link>
    <Link href="/cadastro" style={{ background: "#171915", color: "#c9ff4a", borderRadius: 999, padding: "12px 17px", fontSize: 13, fontWeight: 900, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.16)" }}>Começar grátis →</Link>
  </div>;
}
