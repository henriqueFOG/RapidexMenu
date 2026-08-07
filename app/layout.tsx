import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getBindings, getRapidexEnvironment } from "@/lib/runtime";
import CommercialEntry from "./CommercialEntry";
import "./globals.css";
import "./operational.css";
import "./storefront.css";
import "./storefront-fixes.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RapidexMenu — Venda direta. Cliente de volta.",
  description:
    "Cardápio, pedidos e um vendedor com IA no WhatsApp para restaurantes venderem direto, sem comissão por pedido.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bindings = getBindings();
  const environment = getRapidexEnvironment();
  const commercialEntryEnabled = bindings.RAPIDEX_AUTH_MODE === "native" && Boolean(bindings.RAPIDEX_SESSION_SECRET && bindings.RAPIDEX_SESSION_SECRET.length >= 32);
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {environment === "hmg" && <div style={hmgBadge}>HMG · NÃO É PRODUÇÃO</div>}
        {children}
        <CommercialEntry enabled={commercialEntryEnabled} />
      </body>
    </html>
  );
}

const hmgBadge: React.CSSProperties = {
  position: "fixed",
  top: 80,
  left: 10,
  zIndex: 9999,
  borderRadius: 999,
  padding: "7px 11px",
  background: "#fff3cd",
  color: "#5f4300",
  border: "1px solid #e6c968",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".06em",
  boxShadow: "0 6px 18px rgba(0,0,0,.12)",
};
