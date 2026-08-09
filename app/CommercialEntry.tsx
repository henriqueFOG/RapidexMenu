"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";

const dock: CSSProperties = { position: "fixed", right: 18, bottom: 18, zIndex: 80 };
const trigger: CSSProperties = { height: 42, border: "1px solid #252525", borderRadius: 999, padding: "0 16px", background: "#0b0b0b", color: "#ff7a1a", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 32px rgba(0,0,0,.18)" };
const panel: CSSProperties = { position: "absolute", right: 0, bottom: 52, width: 224, padding: 10, border: "1px solid #e4e4df", borderRadius: 16, background: "rgba(255,255,255,.98)", boxShadow: "0 18px 50px rgba(0,0,0,.15)", display: "grid", gap: 4 };
const item: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 38, padding: "0 11px", borderRadius: 10, color: "#262626", fontSize: 11, fontWeight: 800, textDecoration: "none" };
const primary: CSSProperties = { ...item, background: "#fff2e9", color: "#e95700" };

const links = [
  ["/admin/lucro", "Lucro & ROI", true],
  ["/admin/whatsapp", "WhatsApp", false],
  ["/admin/importar", "Importar cardápio", false],
  ["/admin/horarios", "Horários", false],
  ["/admin/pagamentos", "Pagamentos", false],
  ["/admin/categorias", "Categorias", false],
  ["/assinatura", "Assinatura", false],
] as const;

export default function CommercialEntry({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!enabled || pathname !== "/admin") return null;

  return <div style={dock} aria-label="Atalhos da gestão">
    {open && <div style={panel}>
      <div style={{ padding: "5px 8px 7px" }}><b style={{ display: "block", fontSize: 11 }}>Atalhos da gestão</b><small style={{ color: "#8b8b86", fontSize: 9 }}>Configurações menos usadas, sem poluir o painel.</small></div>
      {links.map(([href, label, featured]) => <Link key={href} href={href} style={featured ? primary : item} onClick={() => setOpen(false)}><span>{label}</span><span aria-hidden="true">→</span></Link>)}
    </div>}
    <button type="button" style={trigger} aria-expanded={open} aria-label={open ? "Fechar atalhos da gestão" : "Abrir atalhos da gestão"} onClick={() => setOpen((value) => !value)}>{open ? "Fechar" : "✦ Atalhos"}</button>
  </div>;
}
