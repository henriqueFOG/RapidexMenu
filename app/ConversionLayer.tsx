"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ConversionLayer() {
  const pathname = usePathname();
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/api") || pathname.startsWith("/acompanhar")) return null;

  const isStore = pathname.startsWith("/loja/");

  if (isStore) {
    return (
      <div className="rmStoreTrust" role="status" aria-label="Compra direta">
        <span className="rmPulse" />
        <b>Pedido direto com o restaurante</b>
        <span>Sem atravessador · acompanhamento do pedido · suporte da própria loja</span>
      </div>
    );
  }

  if (pathname !== "/") return null;

  return (
    <>
      <div className="rmValueBar">
        <span><b>0%</b> comissão por pedido</span>
        <i />
        <span><b>14 dias</b> para testar</span>
        <i />
        <span><b>Sem cartão</b> para começar</span>
      </div>

      {showSticky && (
        <aside className="rmStickyCta" aria-label="Teste do RapidexMenu">
          <div>
            <small>Seu canal próprio pode começar hoje</small>
            <b>Teste o RapidexMenu sem risco.</b>
          </div>
          <button onClick={() => document.querySelector<HTMLButtonElement>(".siteHeader .primary")?.click()}>
            Quero testar grátis <span>→</span>
          </button>
        </aside>
      )}
    </>
  );
}
