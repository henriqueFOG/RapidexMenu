"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./MenuImport.module.css";

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

type Props = { onImported?: () => Promise<void> | void };

type ZipEntry = {
  compression: number;
  compressedSize: number;
  localOffset: number;
};

const sample = `categoria;produto;descricao;preco;custo;preparo;emoji;selo\nHambúrgueres;Smash Clássico;Pão, carne e queijo;29,90;11,50;12;🍔;Mais pedido\nAcompanhamentos;Fritas da Casa;Porção individual;16,90;4,20;8;🍟;`;

export default function MenuImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const preview = useMemo(() => rows.slice(0, 6), [rows]);

  function parseText(value: string) {
    setText(value);
    setError("");
    setMessage("");
    if (!value.trim()) {
      setRows([]);
      return;
    }
    try {
      setRows(parseMenuCsv(value));
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "Não foi possível ler a planilha.");
    }
  }

  async function fileSelected(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setError("");
    setMessage("");
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
        throw new Error("Excel antigo (.xls) não é suportado. Salve como .xlsx, CSV ou use “Colar do Excel”.");
      }
      const isXlsx = lower.endsWith(".xlsx");
      if (!isXlsx && !/\.(csv|txt|tsv)$/i.test(lower)) {
        throw new Error("Envie um arquivo .xlsx, .csv, .tsv ou .txt.");
      }
      const maxSize = isXlsx ? 5_000_000 : 1_000_000;
      if (file.size > maxSize) {
        throw new Error(isXlsx ? "O Excel deve ter no máximo 5 MB." : "O arquivo deve ter no máximo 1 MB.");
      }
      const value = isXlsx ? await xlsxToTabText(file) : await file.text();
      parseText(value);
      setMessage(`${file.name} lido com sucesso. Confira a prévia antes de importar.`);
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "Não foi possível ler a planilha.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function pasteFromExcel() {
    setError("");
    setMessage("");
    try {
      if (!navigator.clipboard?.readText) throw new Error("Seu navegador não liberou a área de transferência.");
      const value = await navigator.clipboard.readText();
      if (!value.trim()) throw new Error("Copie primeiro as células da planilha no Excel e tente novamente.");
      parseText(value);
      setMessage("Dados colados do Excel. Confira a prévia antes de importar.");
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : "Não foi possível colar."} Você também pode abrir “Colar dados manualmente” e usar Ctrl+V.`);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${sample}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modelo-cardapio-rapidex.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function importMenu() {
    if (!rows.length) return;
    setBusy(true);
    setError("");
    setMessage("");
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
      await onImported?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar o cardápio.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.shell}>
    <header className={styles.head}>
      <div className={styles.headTop}>
        <div>
          <small className={styles.eyebrow}>CARDÁPIO EM MINUTOS</small>
          <h2>Já tem uma planilha? Traga tudo de uma vez.</h2>
          <p>Envie Excel ou CSV, ou simplesmente copie as células do Excel. O Rapidex reconhece as colunas, mostra uma prévia e só importa depois da sua confirmação.</p>
        </div>
        <button type="button" className={styles.modelButton} onClick={downloadTemplate}>↓ Baixar modelo</button>
      </div>
    </header>

    <div className={styles.body}>
      <div className={styles.methods}>
        <label
          className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void fileSelected(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain"
            onChange={(event) => void fileSelected(event.target.files?.[0])}
          />
          <span className={styles.dropIcon}>{reading ? "…" : "↑"}</span>
          <b>{reading ? "Lendo sua planilha…" : "Arraste sua planilha aqui"}</b>
          <small>ou clique para escolher · Excel .xlsx, CSV, TSV ou TXT</small>
        </label>

        <div className={styles.excel}>
          <span>▦</span>
          <b>Está com o Excel aberto?</b>
          <p>Selecione a tabela inteira, copie e use o botão abaixo. É o caminho mais rápido.</p>
          <button type="button" onClick={() => void pasteFromExcel()}>Colar do Excel</button>
        </div>
      </div>

      <details className={styles.paste}>
        <summary>Ou colar dados manualmente</summary>
        <textarea
          value={text}
          onChange={(event) => parseText(event.target.value)}
          rows={7}
          spellCheck={false}
          placeholder="Cole aqui as linhas copiadas do Excel ou o conteúdo do CSV…"
        />
      </details>

      <p className={styles.hint}>O mínimo necessário é <b>produto, preço e custo</b>. Categoria, descrição, preparo, emoji e selo são opcionais. Aceitamos nomes comuns como “item”, “valor”, “preço de venda” e “custo unitário”.</p>

      {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}
      {message && <p className={`${styles.status} ${styles.success}`}>{message}</p>}

      {rows.length > 0 && <>
        <div className={styles.preview}>
          <div className={styles.previewHead}><b>Prévia da importação</b><span>{rows.length} {rows.length === 1 ? "produto" : "produtos"}</span></div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Categoria</th><th>Produto</th><th>Preço</th><th>Custo</th><th>Margem</th></tr></thead>
              <tbody>{preview.map((row, index) => <tr key={`${row.category}-${row.name}-${index}`}>
                <td>{row.category}</td>
                <td>{row.emoji} {row.name}</td>
                <td>{money(row.priceCents)}</td>
                <td>{money(row.costCents)}</td>
                <td className={styles.margin}>{Math.round(((row.priceCents - row.costCents) / row.priceCents) * 100)}%</td>
              </tr>)}</tbody>
            </table>
          </div>
          {rows.length > preview.length && <p className={styles.previewMore}>+ {rows.length - preview.length} itens prontos para importar.</p>}
        </div>
        <button type="button" className={styles.importButton} disabled={busy || reading} onClick={() => void importMenu()}>{busy ? "Importando com segurança…" : `Importar ${rows.length} produtos →`}</button>
        <p className={styles.safety}><span>✓</span> Se um produto com o mesmo nome já existir na mesma categoria, o Rapidex atualiza os dados em vez de criar uma cópia.</p>
      </>}
    </div>
  </section>;
}

function parseMenuCsv(input: string): ImportRow[] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Inclua o cabeçalho e pelo menos um produto.");
  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const index = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const categoryIndex = index(["categoria", "grupo", "secao", "sessao", "category"]);
  const nameIndex = index(["produto", "nome", "item", "nomeproduto", "name"]);
  const descriptionIndex = index(["descricao", "detalhes", "ingredientes", "description"]);
  const priceIndex = index(["preco", "valor", "precovenda", "valorvenda", "price"]);
  const costIndex = index(["custo", "custounitario", "customedio", "valorcusto", "cost"]);
  const prepIndex = index(["preparo", "tempo", "minutos", "tempopreparo", "prep", "prepminutes"]);
  const emojiIndex = index(["emoji", "icone", "icon"]);
  const tagIndex = index(["selo", "destaque", "tag"]);
  if (nameIndex < 0 || priceIndex < 0 || costIndex < 0) throw new Error("Não encontrei as colunas de produto, preço e custo. Use o modelo Rapidex ou renomeie essas três colunas.");

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

async function xlsxToTabText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readZipEntries(bytes, view);
  const sheetName = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort(naturalSheetSort)[0];
  if (!sheetName) throw new Error("Não encontrei uma aba legível nesse Excel.");

  const shared = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(await extractZipEntry(bytes, view, entries.get("xl/sharedStrings.xml")!))
    : [];
  const sheetXml = decodeXml(await extractZipEntry(bytes, view, entries.get(sheetName)!));
  const document = new DOMParser().parseFromString(sheetXml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("A primeira aba do Excel está corrompida ou não pôde ser lida.");

  const output: string[] = [];
  for (const row of Array.from(document.getElementsByTagName("row"))) {
    const cells: string[] = [];
    let fallbackIndex = 0;
    for (const element of Array.from(row.getElementsByTagName("c"))) {
      const ref = element.getAttribute("r") || "";
      const position = ref ? excelColumnIndex(ref) : fallbackIndex;
      while (cells.length <= position) cells.push("");
      cells[position] = excelCellValue(element, shared).replace(/[\t\r\n]+/g, " ").trim();
      fallbackIndex = position + 1;
    }
    if (cells.some((value) => value.trim())) output.push(cells.join("\t"));
  }
  if (output.length < 2) throw new Error("A primeira aba precisa ter cabeçalho e pelo menos um produto.");
  return output.join("\n");
}

function readZipEntries(bytes: Uint8Array, view: DataView) {
  const end = findZipEnd(bytes);
  const total = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < total; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("O arquivo .xlsx não possui uma estrutura ZIP válida.");
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { compression, compressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findZipEnd(bytes: Uint8Array) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) return index;
  }
  throw new Error("O arquivo .xlsx está incompleto ou inválido.");
}

async function extractZipEntry(bytes: Uint8Array, view: DataView, entry: ZipEntry) {
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Não foi possível abrir uma parte interna do Excel.");
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error("Seu navegador não consegue descompactar este Excel. Use “Colar do Excel” ou envie CSV.");
  }
  const raw = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(bytes: Uint8Array) {
  const document = new DOMParser().parseFromString(decodeXml(bytes), "application/xml");
  return Array.from(document.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((node) => node.textContent || "").join(""),
  );
}

function excelCellValue(cellElement: Element, shared: string[]) {
  const type = cellElement.getAttribute("t") || "";
  if (type === "inlineStr") return Array.from(cellElement.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
  const raw = cellElement.getElementsByTagName("v")[0]?.textContent || "";
  if (type === "s") return shared[Number(raw)] || "";
  if (type === "b") return raw === "1" ? "Sim" : "Não";
  return raw;
}

function excelColumnIndex(reference: string) {
  const letters = reference.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function naturalSheetSort(a: string, b: string) {
  const number = (value: string) => Number(value.match(/sheet(\d+)/i)?.[1] || 0);
  return number(a) - number(b);
}

function decodeXml(bytes: Uint8Array) { return new TextDecoder("utf-8").decode(bytes); }
function detectSeparator(header: string) {
  const counts = [[";", count(header, ";")], ["\t", count(header, "\t")], [",", count(header, ",")]] as const;
  return counts.toSorted((a, b) => b[1] - a[1])[0][0];
}
function count(value: string, token: string) { return value.split(token).length - 1; }
function normalizeHeader(value: string) { return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function cell(cells: string[], position: number) { return position >= 0 ? (cells[position] || "").trim() : ""; }
function splitCsvLine(line: string, separator: string) {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
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
