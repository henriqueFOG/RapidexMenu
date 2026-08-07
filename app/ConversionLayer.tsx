"use client";

import { usePathname } from "next/navigation";
import ApprovedLandingV4 from "./ApprovedLandingV4";

export default function ConversionLayer() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/api") || pathname.startsWith("/acompanhar") || pathname.startsWith("/demo")) return null;

  if (pathname.startsWith("/loja/")) {
    return (
      <div className="rmStoreTrust" role="status" aria-label="Compra direta">
        <span className="rmPulse" />
        <b>Pedido direto com o restaurante</b>
        <span>Sem atravessador · acompanhamento do pedido · suporte da própria loja</span>
      </div>
    );
  }

  if (pathname === "/") return <ApprovedLandingV4 />;

  return null;
}
