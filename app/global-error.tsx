"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body style={{ margin: 0, minHeight: "100vh", background: "#111826", color: "white", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif" }}><main style={{ width: "min(520px, calc(100% - 32px))", textAlign: "center" }}><div style={{ width: 52, height: 52, borderRadius: 15, margin: "0 auto", display: "grid", placeItems: "center", background: "#ff650b", fontWeight: 900 }}>R</div><h1>O RapidexMenu precisa ser recarregado.</h1><p style={{ color: "#aab1bd", lineHeight: 1.6 }}>Uma falha inesperada interrompeu esta tela. Seus dados permanecem protegidos.</p><button type="button" onClick={reset} style={{ border: 0, borderRadius: 10, padding: "12px 16px", background: "#ff650b", color: "white", fontWeight: 800, cursor: "pointer" }}>Recarregar aplicação</button></main></body></html>;
}
