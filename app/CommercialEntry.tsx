"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

const wrapper: CSSProperties = { position: "fixed", right: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const light: CSSProperties = { background: "#fff", color: "#171717", border: "1px solid #dedede", borderRadius: 999, padding: "11px 15px", fontSize: 13, fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.09)" };
const dark: CSSProperties = { background: "#080808", color: "#ff8a3d", border: "1px solid #252525", borderRadius: 999, padding: "12px 17px", fontSize: 13, fontWeight: 900, textDecoration: "none", boxShadow: "0 10px 30px rgba(0,0,0,.16)" };

export default function CommercialEntry({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled || pathname === "/") return null;
  if (pathname === "/admin") {
    return <div style={wrapper} aria-label="Atalhos da gestão"><Link href="/admin/lucro" style={dark}>✦ Lucro & ROI</Link><Link href="/admin/whatsapp" style={light}>WhatsApp</Link><Link href="/admin/importar" style={light}>Importar</Link><Link href="/admin/horarios" style={light}>Horários</Link><Link href="/admin/pagamentos" style={light}>Pagamentos</Link><Link href="/admin/categorias" style={light}>Categorias</Link><Link href="/assinatura" style={light}>Assinatura</Link></div>;
  }
  return null;
}
