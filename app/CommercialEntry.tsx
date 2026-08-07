"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const light = { background: "#fff", color: "#171915", border: "1px solid #dfe3d7", borderRadius: 999, padding: "11px 15px", fontSize: 13, fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.09)" } as const;
const dark = { background: "#171915", color: "#c9ff4a", borderRadius: 999, padding: "12px 17px", fontSize: 13, fontWeight: 900, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.16)" } as const;

export default function CommercialEntry({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled) return null;
  const wrapper = <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }} />;

  if (pathname === "/") {
    return <div {...wrapper.props}><Link href="/entrar" style={light}>Entrar</Link><Link href="/cadastro" style={dark}>Começar grátis →</Link></div>;
  }
  if (pathname === "/admin") {
    return <div {...wrapper.props}><Link href="/admin/categorias" style={light}>Categorias</Link><Link href="/assinatura" style={dark}>Assinatura</Link></div>;
  }
  return null;
}
