import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getBindings } from "@/lib/runtime";
import CommercialEntry from "./CommercialEntry";
import "./globals.css";
import "./operational.css";

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
  const commercialEntryEnabled = bindings.RAPIDEX_AUTH_MODE === "native" && Boolean(bindings.RAPIDEX_SESSION_SECRET && bindings.RAPIDEX_SESSION_SECRET.length >= 32);
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <CommercialEntry enabled={commercialEntryEnabled} />
      </body>
    </html>
  );
}
