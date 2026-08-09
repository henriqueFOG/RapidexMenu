"use client";

import { useRef, useState } from "react";
import styles from "./ProductImageUpload.module.css";

type Props = {
  imageUrl?: string | null;
  label?: string;
  compact?: boolean;
  onUploaded: (key: string, url: string) => Promise<void> | void;
};

export default function ProductImageUpload({ imageUrl, label = "Foto do produto", compact = false, onUploaded }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(imageUrl || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = () => input.current?.click();
  const changed = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use uma foto JPG, PNG ou WebP.");
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.set("file", optimized, optimized.name);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({})) as { key?: string; url?: string; error?: { message?: string } };
      if (!response.ok || !payload.key || !payload.url) throw new Error(payload.error?.message || "Não foi possível enviar a foto.");
      setPreview(payload.url);
      await onUploaded(payload.key, payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return <div className={`${styles.field} ${compact ? styles.compact : ""}`}>
    <input ref={input} className={styles.input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changed(event.target.files?.[0])} />
    <button type="button" className={styles.preview} onClick={choose} disabled={busy} aria-label={`${preview ? "Trocar" : "Adicionar"} ${label.toLowerCase()}`}>
      {preview ? <img src={preview} alt="" /> : <span aria-hidden="true">📷</span>}
      <em>{busy ? "Enviando…" : preview ? "Trocar foto" : compact ? "+ Foto" : "Adicionar foto"}</em>
    </button>
    {!compact && <small>JPG, PNG ou WebP. A foto é otimizada automaticamente.</small>}
    {error && <strong role="alert">{error}</strong>}
  </div>;
}

async function optimizeImage(file: File) {
  if (file.size <= 750 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .82));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "produto"}.webp`, { type: "image/webp" });
}
