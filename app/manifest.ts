import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RapidexMenu",
    short_name: "Rapidex",
    description: "Cardápio, pedidos e operação de restaurantes no canal próprio.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#11120f",
    theme_color: "#11120f",
    lang: "pt-BR",
    categories: ["business", "food", "productivity"],
    icons: [
      {
        src: "/api/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon/512?maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Pedidos",
        short_name: "Pedidos",
        description: "Abrir o painel de pedidos do restaurante.",
        url: "/admin",
        icons: [{ src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Cozinha",
        short_name: "Cozinha",
        description: "Abrir o KDS da cozinha.",
        url: "/admin/cozinha",
        icons: [{ src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
