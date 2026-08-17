import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getBindings, getRapidexEnvironment } from "@/lib/runtime";
import CommercialEntry from "./CommercialEntry";
import ConversionLayer from "./ConversionLayer";
import PwaLifecycle from "./PwaLifecycle";
import "./globals.css";
import "./operational.css";
import "./storefront.css";
import "./storefront-fixes.css";
import "./conversion.css";
import "./brand-v2.css";
import "./identity.css";
import "./fidelity-overrides.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11120f",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://rapidexmenu.com.br"),
  applicationName: "RapidexMenu",
  title: "RapidexMenu — Cardápio online, pedidos e entrega",
  description: "Cardápio online, pedidos, gestão e automação para restaurantes venderem no canal próprio sem comissão por pedido.",
  keywords: ["cardápio digital", "delivery próprio", "pedidos WhatsApp", "restaurante", "vendas diretas", "RapidexMenu"],
  appleWebApp: {
    capable: true,
    title: "RapidexMenu",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "RapidexMenu — Cardápio Online. Pedidos. Entrega. Simples assim.",
    description: "A plataforma completa para restaurantes venderem direto, organizarem pedidos e encantarem clientes.",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/rapidex-og.svg", width: 1200, height: 630, alt: "RapidexMenu — cardápio online e pedidos para restaurantes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RapidexMenu — Cardápio Online. Pedidos. Entrega.",
    description: "Venda direto, organize pedidos e construa seu canal próprio.",
    images: ["/rapidex-og.svg"],
  },
  other: { "codex-preview": "development" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: [{ url: "/api/pwa/icon/180", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bindings = getBindings();
  const environment = getRapidexEnvironment();
  const commercialEntryEnabled = bindings.RAPIDEX_AUTH_MODE === "native" && Boolean(bindings.RAPIDEX_SESSION_SECRET && bindings.RAPIDEX_SESSION_SECRET.length >= 32);
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
    {environment === "hmg" && <div className="rm-hmg-env-badge" style={hmgBadge}>HMG · NÃO É PRODUÇÃO</div>}
    <PwaLifecycle />
    {children}
    <ConversionLayer />
    <CommercialEntry enabled={commercialEntryEnabled} />
    <Analytics />
    <SpeedInsights />
  </body></html>;
}

const hmgBadge: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: 0,
  zIndex: 9999,
  pointerEvents: "none",
  userSelect: "none",
  transform: "translateY(-50%)",
  writingMode: "vertical-rl",
  borderRadius: "0 9px 9px 0",
  padding: "9px 5px",
  background: "rgba(23,23,23,.92)",
  color: "#ff8a3d",
  border: "1px solid #3a3a3a",
  borderLeft: 0,
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: ".08em",
  boxShadow: "0 6px 18px rgba(0,0,0,.18)",
};
