import "server-only";

import { createProduct, listProducts, updateProduct } from "@/lib/repo";
import type { Category } from "@/lib/types";

const ENDPOINT = "https://cuantico.tech/ws_get_productos/";

type CuanticoProduct = Record<string, unknown>;

function stringValue(row: CuanticoProduct, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

function priceValue(row: CuanticoProduct): number | undefined {
  const value = stringValue(row, "precio", "price", "precio_venta", "precio_final");
  if (!value) return undefined;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) ? Math.round(price) : undefined;
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
  const localProducts = await listProducts();

  for (const row of rows) {
    const erpId = stringValue(row, "id_erp", "id_producto", "id", "codigo");
    const name = stringValue(row, "nombre", "name", "descripcion", "detalle");
    const price = priceValue(row);
    if (!erpId || !name || price === undefined) continue;
    const id = `cuantico-${erpId}`;
    const category: Category = "cortes";
    const input = { name, description: name, price, category, image: "", available: true, stock: 50 };
    const existing = localProducts.find((product) => product.id === id);
    if (existing) {
      await updateProduct(id, input);
      updated++;
    } else {
      await createProduct({ id, ...input });
      created++;
    }
  }
  return { received: rows.length, created, updated };
}
