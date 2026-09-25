/**
 * Lectura de la lista mayorista pegada desde Excel o un CSV con ";" (datos
 * puros, sin `server-only`: también la usa el panel para la vista previa).
 */

export interface WholesaleImportRow {
  code?: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  /** undefined = no informado (se conserva); null = sin control de stock. */
  stock?: number | null;
}

type Column = "code" | "name" | "description" | "category" | "price" | "stock";

const HEADER_ALIASES: Record<Column, string[]> = {
  code: ["codigo", "cod", "sku", "id"],
  name: ["nombre", "producto", "articulo"],
  description: ["descripcion", "detalle", "presentacion"],
  category: ["categoria", "rubro", "familia"],
  price: ["precio", "precio mayorista", "mayorista", "importe", "valor"],
  stock: ["stock", "cantidad", "existencia", "existencias"],
};

/** Orden por defecto cuando la primera fila no es un encabezado. */
const DEFAULT_COLUMNS: Column[] = ["name", "price", "stock", "category", "code"];

function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "$ 38.500", "38500", "38.500,50" → pesos enteros. */
export function parseArsAmount(raw: string): number | undefined {
  const value = raw.replace(/[$\s]/g, "");
  if (!value) return undefined;
  let normalized: string;
  if (value.includes(",")) normalized = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) normalized = value.replace(/\./g, "");
  else normalized = value;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : undefined;
}

function headerColumn(cell: string): Column | undefined {
  const key = searchable(cell);
  return (Object.keys(HEADER_ALIASES) as Column[]).find((column) =>
    HEADER_ALIASES[column].includes(key)
  );
}

export function parseWholesaleSheet(text: string): { rows: WholesaleImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { rows: [], errors: [] };

  const separator = lines[0].includes("\t") ? "\t" : ";";
  const split = (line: string) => line.split(separator).map((cell) => cell.trim());

  const firstCells = split(lines[0]);
  const headerColumns = firstCells.map(headerColumn);
  const hasHeader = headerColumns.includes("name") && headerColumns.includes("price");
  const columns = hasHeader ? headerColumns : DEFAULT_COLUMNS;
  const hasStockColumn = columns.includes("stock");

  const rows: WholesaleImportRow[] = [];
  const errors: string[] = [];
  lines.slice(hasHeader ? 1 : 0).forEach((line, index) => {
    const lineNumber = index + (hasHeader ? 2 : 1);
    const cells = split(line);
    const cell = (column: Column) => {
      const position = columns.indexOf(column);
      return position === -1 ? "" : cells[position] ?? "";
    };

    const name = cell("name").slice(0, 200);
    const price = parseArsAmount(cell("price"));
    if (!name) {
      errors.push(`Fila ${lineNumber}: falta el nombre.`);
      return;
    }
    if (!price) {
      errors.push(`Fila ${lineNumber} (${name}): precio inválido.`);
      return;
    }

    let stock: number | null | undefined;
    if (hasStockColumn) {
      const rawStock = cell("stock").replace(/\./g, "").replace(",", ".");
      if (!rawStock) stock = null;
      else {
        const parsed = Math.floor(Number(rawStock));
        if (!Number.isFinite(parsed) || parsed < 0) {
          errors.push(`Fila ${lineNumber} (${name}): stock inválido.`);
          return;
        }
        stock = parsed;
      }
    }

    rows.push({
      code: cell("code").slice(0, 100) || undefined,
      name,
      description: cell("description").slice(0, 500) || undefined,
      category: cell("category").slice(0, 100) || undefined,
      price,
      stock,
    });
  });

  return { rows, errors };
}
