"use client";

import { useRef, useState } from "react";

type Product = {
  id: unknown;
  name: unknown;
  emoji: unknown;
  imageUrl?: unknown;
};

export default function ProductImageUpload({ product, onDone }: { product: Product; onDone: () => Promise<void> }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imageUrl = typeof product.imageUrl === "string" && product.imageUrl ? product.imageUrl : null;

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({})) as { key?: string; error?: { message?: string } };
      if (!response.ok || !payload.key) throw new Error(payload.error?.message || "Não foi possível enviar a foto.");
      const save = await fetch(`/api/admin/products/${String(product.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageKey: payload.key }),
      });
      const saved = await save.json().catch(() => ({})) as { error?: { message?: string } };
      if (!save.ok) throw new Error(saved.error?.message || "A foto foi enviada, mas não pôde ser vinculada ao produto.");
      await onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div style={wrapStyle}>
    <button
      type="button"
      onClick={() => input.current?.click()}
      disabled={busy}
      aria-label={`${imageUrl ? "Trocar" : "Adicionar"} foto de ${String(product.name)}`}
      title={imageUrl ? "Trocar foto" : "Adicionar foto"}
      style={buttonStyle}
    >
      {imageUrl
        ? <img src={imageUrl} alt="" style={imageStyle} />
        : <span aria-hidden="true" style={emojiStyle}>{String(product.emoji || "🍽️")}</span>}
      <span style={cameraStyle}>{busy ? "…" : "📷"}</span>
    </button>
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) void upload(file);
      }}
    />
    {error && <span role="alert" style={errorStyle}>{error}</span>}
  </div>;
}

const wrapStyle: React.CSSProperties = { position: "relative", flex: "0 0 auto" };
const buttonStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  border: "1px solid #e6e2dc",
  background: "#f7f5f2",
  padding: 0,
  overflow: "hidden",
  position: "relative",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};
const imageStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
const emojiStyle: React.CSSProperties = { fontSize: 24 };
const cameraStyle: React.CSSProperties = {
  position: "absolute",
  right: 2,
  bottom: 2,
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#111",
  color: "white",
  fontSize: 9,
  boxShadow: "0 2px 6px rgba(0,0,0,.18)",
};
const errorStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 52,
  width: 220,
  zIndex: 5,
  padding: "7px 9px",
  borderRadius: 8,
  background: "#fff2ef",
  border: "1px solid #ffc8bc",
  color: "#9e2c16",
  fontSize: 10,
  fontWeight: 700,
  boxShadow: "0 8px 22px rgba(0,0,0,.1)",
};
