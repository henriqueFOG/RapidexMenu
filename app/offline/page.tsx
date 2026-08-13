import Link from "next/link";

export const metadata = {
  title: "Sem conexão | RapidexMenu",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={markStyle}>R</div>
        <p style={eyebrowStyle}>RapidexMenu</p>
        <h1 style={titleStyle}>Você está sem conexão</h1>
        <p style={copyStyle}>
          Para proteger pedidos, pagamentos e alterações de operação, o RapidexMenu não confirma ações críticas sem falar com o servidor.
          Assim que a internet voltar, abra novamente a tela que estava usando.
        </p>
        <div style={actionsStyle}>
          <Link href="/admin" style={primaryStyle}>Tentar abrir o painel</Link>
          <Link href="/" style={secondaryStyle}>Ir para o início</Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#11120f",
  color: "#f7f7f2",
};
const cardStyle: React.CSSProperties = {
  width: "min(560px, 100%)",
  padding: "36px 28px",
  borderRadius: 24,
  background: "#191a16",
  border: "1px solid #34362f",
  textAlign: "center",
  boxShadow: "0 24px 80px rgba(0,0,0,.35)",
};
const markStyle: React.CSSProperties = {
  width: 70,
  height: 70,
  margin: "0 auto 18px",
  display: "grid",
  placeItems: "center",
  borderRadius: 18,
  background: "#ff6b0a",
  color: "#11120f",
  fontWeight: 950,
  fontSize: 40,
};
const eyebrowStyle: React.CSSProperties = { margin: 0, color: "#c9ff4a", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 11 };
const titleStyle: React.CSSProperties = { margin: "8px 0 12px", fontSize: "clamp(28px, 7vw, 42px)", lineHeight: 1.05 };
const copyStyle: React.CSSProperties = { margin: "0 auto", maxWidth: 470, color: "#c7cabf", lineHeight: 1.6, fontSize: 14 };
const actionsStyle: React.CSSProperties = { marginTop: 24, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" };
const primaryStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: 12, background: "#c9ff4a", color: "#11120f", fontWeight: 900, textDecoration: "none" };
const secondaryStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: 12, border: "1px solid #3d4037", color: "#f7f7f2", fontWeight: 800, textDecoration: "none" };
