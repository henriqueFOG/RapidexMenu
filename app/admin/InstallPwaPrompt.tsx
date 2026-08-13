"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const dismissedKey = "rapidex-pwa-install-dismissed-at";
const reminderAfterMs = 7 * 24 * 60 * 60 * 1000;

export default function InstallPwaPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const ua = navigator.userAgent;
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isAppleMobile);

    const dismissedAt = Number(window.localStorage.getItem(dismissedKey) || 0);
    setDismissed(Boolean(dismissedAt && Date.now() - dismissedAt < reminderAfterMs));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstalled(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHelp(false);
      window.localStorage.removeItem(dismissedKey);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const eligible = useMemo(() => !installed && !dismissed && (Boolean(installEvent) || ios), [dismissed, installEvent, installed, ios]);
  if (pathname === "/admin/login" || !eligible) return null;

  async function install() {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          setInstallEvent(null);
          return;
        }
      } catch {
        // Browsers may invalidate a stored install event. Keep manual guidance available below.
      }
    }
    if (ios) setShowIosHelp(true);
  }

  function dismiss() {
    window.localStorage.setItem(dismissedKey, String(Date.now()));
    setDismissed(true);
    setShowIosHelp(false);
  }

  return <aside aria-label="Instalar RapidexMenu" style={wrapperStyle}>
    <div style={headingRowStyle}>
      <span aria-hidden="true" style={markStyle}>R</span>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 12 }}>Rapidex no seu dispositivo</strong>
        <span style={{ display: "block", marginTop: 2, color: "#aeb2a5", fontSize: 10, lineHeight: 1.35 }}>
          Abra pedidos e cozinha em tela cheia, como um app.
        </span>
      </div>
      <button type="button" onClick={dismiss} aria-label="Lembrar depois" title="Lembrar depois" style={closeStyle}>×</button>
    </div>

    {showIosHelp ? <div role="status" style={helpStyle}>
      No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
    </div> : <button type="button" onClick={() => void install()} style={installStyle}>
      Instalar Rapidex
    </button>}
  </aside>;
}

const wrapperStyle: React.CSSProperties = {
  position: "fixed",
  left: "max(14px, env(safe-area-inset-left))",
  bottom: "max(14px, env(safe-area-inset-bottom))",
  zIndex: 84,
  width: "min(310px, calc(100vw - 28px))",
  padding: 12,
  borderRadius: 16,
  background: "#171814",
  color: "#f8f8f2",
  border: "1px solid #34362f",
  boxShadow: "0 16px 38px rgba(0,0,0,.22)",
};
const headingRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "34px 1fr 28px", alignItems: "center", gap: 9 };
const markStyle: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "#ff6b0a", color: "#11120f", fontSize: 18, fontWeight: 950 };
const closeStyle: React.CSSProperties = { width: 28, height: 28, border: 0, borderRadius: 999, background: "transparent", color: "#aeb2a5", fontSize: 22, lineHeight: 1, cursor: "pointer", touchAction: "manipulation" };
const installStyle: React.CSSProperties = { width: "100%", minHeight: 44, marginTop: 10, border: 0, borderRadius: 11, background: "#c9ff4a", color: "#151610", fontWeight: 900, cursor: "pointer", touchAction: "manipulation" };
const helpStyle: React.CSSProperties = { marginTop: 10, padding: "10px 11px", borderRadius: 11, background: "#25271f", color: "#e7eadf", fontSize: 11, lineHeight: 1.45 };
