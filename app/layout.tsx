import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <CommercialEntry />
      </body>
    </html>
  );
}
