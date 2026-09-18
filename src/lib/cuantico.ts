import "server-only";

import { createProduct, listProducts, updateProduct } from "@/lib/repo";
import type { Category } from "@/lib/types";
import { cuanticoPricePolicy, validatedCuanticoPrice } from "@/lib/cuantico-pricing";

const ENDPOINT = "https://cuantico.tech/ws_get_productos/";

type CuanticoProduct = Record<string, unknown>;

function stringValue(row: CuanticoProduct, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

export function parseCuanticoPrice(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : undefined;
  const value = typeof raw === "string" ? raw.trim() : undefined;
  if (!value) return undefined;

  const normalizedValue = value.replace(/\s/g, "");
  let normalized: string;

  if (normalizedValue.includes(",")) {
    // 3.600,00 -> 3600; 817,50 -> 817.50
    normalized = normalizedValue.includes(".")
      ? normalizedValue.replace(/\./g, "").replace(",", ".")
      : normalizedValue.replace(",", ".");
  } else if (/^\d+\.\d{3}$/.test(normalizedValue)) {
    // 3.600 is a thousands separator when there are exactly three digits.
    normalized = normalizedValue.replace(".", "");
  } else {
    // 817.0000 and 3600.00 are decimal values, not thousands separators.
    normalized = normalizedValue;
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? Math.round(price) : undefined;
}

function priceValue(row: CuanticoProduct): number | undefined {
  const raw = row.precio ?? row.Precio ?? row.price ?? row.precio_venta ?? row.PrecioVenta ?? row.precio_final ?? row.PrecioFinal;
  return parseCuanticoPrice(raw);
}

function stockValue(row: CuanticoProduct): number | undefined {
  const raw = row.stock ?? row.Stock ?? row.stock_actual ?? row.StockActual ?? row.existencias ?? row.Existencias;
  if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;
  const stock = Number(String(raw).replace(",", "."));
  return Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : undefined;
}

function rowsFromResponse(value: unknown): CuanticoProduct[] {
  if (Array.isArray(value)) return value.filter((row): row is CuanticoProduct => !!row && typeof row === "object");
  if (value && typeof value === "object") {
    const data = (value as Record<string, unknown>).data ?? (value as Record<string, unknown>).productos;
    return rowsFromResponse(data);
  }
  return [];
}

export async function syncCuanticoProducts(options: { fecha?: string } = {}) {
  const policy = cuanticoPricePolicy(process.env);
  const idEmpresa = process.env.CUANTICO_ID_EMPRESA;
  const token = process.env.CUANTICO_TOKEN;
  if (!idEmpresa || !token) throw new Error("Faltan CUANTICO_ID_EMPRESA y CUANTICO_TOKEN.");

  const params = new URLSearchParams({ id_empresa: idEmpresa, token });
  if (options.fecha) params.set("fecha", options.fecha);
  const response = await fetch(`${ENDPOINT}?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cuantico respondió HTTP ${response.status}.`);
  const rows = rowsFromResponse(await response.json());
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let zeroPrice = 0;
  const localProducts = await listProducts();
  const byId = new Map(localProducts.map((product) => [product.id, product]));
  const pending: { id: string; name: string; price: number; stock: number | undefined }[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const erpId = stringValue(row, "id_erp", "IdErp", "id_producto", "IdProducto", "id", "codigo");
    const name = stringValue(row, "nombre", "Nombre", "name", "descripcion", "Descripcion", "detalle");
    const rawPrice = priceValue(row);
    if (!erpId || !name || rawPrice === undefined) {
      skipped++;
      continue;
    }
    if (rawPrice === 0) {
      // A zero from the ERP is not a valid sale price. Keep an existing
      // verified price untouched and report the row for manual review.
      zeroPrice++;
      skipped++;
      continue;
    }
    const id = `cuantico-${erpId}`;
    if (seen.has(id)) {
      rejected.push(`${id}: ID duplicado en la fuente.`);
      continue;
    }
    seen.add(id);
    try {
      const price = validatedCuanticoPrice(rawPrice, byId.get(id)?.price, policy);
      pending.push({ id, name, price, stock: stockValue(row) });
    } catch (error) {
      rejected.push(`${id}: ${error instanceof Error ? error.message : 'Precio inválido.'}`);
    }
  }
  // Validar el lote completo antes de tocar datos: una escala inesperada no
  // debe dejar miles de precios parcialmente actualizados.
  if (rejected.length) {
    throw new Error(`Sincronización bloqueada sin cambios: ${rejected.length} precios requieren revisión. ${rejected.slice(0, 10).join(' | ')}`);
  }
  for (const { id, name, price, stock } of pending) {
    const category: Category = "cortes";
    const existing = byId.get(id);
    if (existing) {
      await updateProduct(id, { name, description: name, price, category, image: "", available: true, ...(stock === undefined ? {} : { stock }) });
      updated++;
    } else {
      await createProduct({ id, name, description: name, price, category, image: "", available: price > 0, stock: stock ?? 0 });
      created++;
    }
  }
  return { received: rows.length, created, updated, skipped, zeroPrice };
}
