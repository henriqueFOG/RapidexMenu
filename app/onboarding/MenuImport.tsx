"use client";

import { useMemo, useState } from "react";
import styles from "../commercial.module.css";

type ImportRow = {
  category: string;
  name: string;
  description: string;
  priceCents: number;
  costCents: number;
  prepMinutes: number;
  emoji: string;
  tag: string;
};

type Props = { onImported: () => Promise<void> | void };

const sample = `categoria;produto;descricao;preco;custo;preparo;emoji;selo\nHambúrgueres;Smash Clássico;Pão, carne e queijo;29,90;11,50;12;🍔;Mais pedido\nAcompanhamentos;Fritas da Casa;Porção individual;16,90;4,20;8;🍟;`;

export default function MenuImport({ onImported }: Props) {
  const [text, setText] = useState(sample);
  const [rows, setRows] = useState<ImportRow[]>(() => parseMenuCsv(sample));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  function parse(value: string) {
    setText(value);
    setError("");
    setMessage("");
    try { setRows(parseMenuCsv(value)); } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "Não foi possível ler o arquivo.");
    }
  }

  async function fileSelected(file: File | undefined) {
    if (!file) return;
    if (file.size > 500_000) {
      setError("O arquivo deve ter no máximo 500 KB.");
      return;
    }
    parse(await file.text());
  }

  async function importMenu() {
    if (!rows.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/menu-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const payload = await response.json().catch(() => ({})) as {
        rows?: number;
        categoriesCreated?: number;
        productsCreated?: number;
        productsUpdated?: number;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível importar o cardápio.");
      setMessage(`${payload.rows || rows.length} itens processados · ${payload.productsCreated || 0} criados · ${payload.productsUpdated || 0} atualizados.`);
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar o cardápio.");
    } finally { setBusy(false); }
  }

  return <section className={styles.panel}>
    <h2>Importe seu cardápio de uma vez</h2>
    <p>Exporte sua planilha como CSV ou cole os dados abaixo. O Rapidex usa o custo para calcular margem e alimentar o Profit Engine.</p>
    <div className={styles.grid}>
      <label className={`${styles.field} ${styles.wide}`}>Arquivo CSV ou TXT
        <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => void fileSelected(event.target.files?.[0])} />
      </label>
      <label className={`${styles.field} ${styles.wide}`}>Conteúdo do cardápio
        <textarea value={text} onChange={(event) => parse(event.target.value)} rows={8} spellCheck={false} style={{ resize: "vertical" }} />
      </label>
    </div>
    <p className={styles.note}>Colunas: categoria; produto; descrição; preço; custo; preparo; emoji; selo. Preço e custo aceitam formato brasileiro, como 29,90.</p>
    {error && <p className={styles.error}>{error}</p>}
    {message && <p className={styles.success}>{message}</p>}
    {rows.length > 0 && <>
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr><th align="left">Categoria</th><th align="left">Produto</th><th align="right">Preço</th><th align="right">Custo</th><th align="right">Margem</th></tr></thead>
          <tbody>{preview.map((row, index) => <tr key={`${row.category}-${row.name}-${index}`}>
            <td style={{ padding: "8px 4px" }}>{row.category}</td>
            <td style={{ padding: "8px 4px" }}>{row.emoji} {row.name}</td>
            <td align="right">{money(row.priceCents)}</td>
            <td align="right">{money(row.costCents)}</td>
            <td align="right">{Math.round(((row.priceCents - row.costCents) / row.priceCents) * 100)}%</td>
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length > preview.length && <p className={styles.note}>+ {rows.length - preview.length} itens no arquivo.</p>}
      <button className={styles.button} disabled={busy} onClick={() => void importMenu()}>{busy ? "Importando…" : `Importar ${rows.length} produtos →`}</button>
    </>}
  </section>;
}

function parseMenuCsv(input: string): ImportRow[] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Inclua o cabeçalho e pelo menos um produto.");
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const index = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const categoryIndex = index(["categoria", "category"]);
  const nameIndex = index(["produto", "nome", "name"]);
  const descriptionIndex = index(["descricao", "description"]);
  const priceIndex = index(["preco", "price"]);
  const costIndex = index(["custo", "cost"]);
  const prepIndex = index(["preparo", "prep", "tempodepreparo", "prepminutes"]);
  const emojiIndex = index(["emoji"]);
  const tagIndex = index(["selo", "tag"]);
  if (nameIndex < 0 || priceIndex < 0 || costIndex < 0) throw new Error("O arquivo precisa das colunas produto, preço e custo.");

  const rows = lines.slice(1).map((line, offset) => {
    const cells = splitCsvLine(line, separator);
    const name = cell(cells, nameIndex);
    const priceCents = parseMoneyToCents(cell(cells, priceIndex));
    const costRaw = cell(cells, costIndex);
    const costCents = parseMoneyToCents(costRaw);
    if (!name) throw new Error(`Linha ${offset + 2}: produto vazio.`);
    if (!Number.isInteger(priceCents) || priceCents < 100) throw new Error(`Linha ${offset + 2}: preço inválido.`);
    if (!costRaw || !Number.isInteger(costCents) || costCents < 0) throw new Error(`Linha ${offset + 2}: informe o custo.`);
    if (costCents >= priceCents) throw new Error(`Linha ${offset + 2}: o preço precisa ser maior que o custo.`);
    const prep = Number(cell(cells, prepIndex) || 10);
    if (!Number.isInteger(prep) || prep < 1 || prep > 180) throw new Error(`Linha ${offset + 2}: preparo inválido.`);
    return {
      category: cell(cells, categoryIndex) || "Principais",
      name,
      description: cell(cells, descriptionIndex),
      priceCents,
      costCents,
      prepMinutes: prep,
      emoji: cell(cells, emojiIndex) || "🍽️",
      tag: cell(cells, tagIndex),
    };
  });
  if (rows.length > 250) throw new Error("Importe no máximo 250 produtos por vez.");
  return rows;
}

function detectSeparator(header: string) {
  const counts = [[";", count(header, ";")], ["\t", count(header, "\t")], [",", count(header, ",")]] as const;
  return counts.toSorted((a, b) => b[1] - a[1])[0][0];
}
function count(value: string, token: string) { return value.split(token).length - 1; }
function normalizeHeader(value: string) { return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function cell(cells: string[], position: number) { return position >= 0 ? (cells[position] || "").trim() : ""; }
function splitCsvLine(line: string, separator: string) {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === separator && !quoted) { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current); return cells;
}
function parseMoneyToCents(value: string) {
  const raw = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!raw) return Number.NaN;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}
function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
