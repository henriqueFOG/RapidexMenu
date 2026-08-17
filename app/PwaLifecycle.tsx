"use client";

import { useEffect, useState } from "react";

export default function PwaLifecycle() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const syncConnection = () => {
      const next = navigator.onLine;
      setOnline(next);
      window.dispatchEvent(new CustomEvent(next ? "rapidex:online" : "rapidex:offline"));
    };

    const initialSync = window.setTimeout(syncConnection, 0);
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // PWA enhancement must never block the restaurant's core operation.
      });
    }

    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={offlineBannerStyle}
    >
      <strong>Sem conexão.</strong>
      <span>Os dados exibidos podem estar desatualizados. Ações operacionais ficam bloqueadas até a internet voltar.</span>
    </div>
  );
}

const offlineBannerStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 14,
  zIndex: 10050,
  width: "min(680px, calc(100vw - 28px))",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "11px 14px",
  borderRadius: 14,
  background: "#fff3cd",
  color: "#4c3800",
  border: "1px solid #e7c75c",
  boxShadow: "0 12px 34px rgba(0,0,0,.18)",
  fontSize: 12,
};
