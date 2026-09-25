import "server-only";

import { z } from "zod";
import { hasDatabase, prisma } from "./prisma";
import { NoDatabaseError } from "./repo";
import type { WholesaleProduct } from "./types";
import type { WholesaleImportRow } from "./wholesale-import";

type WholesaleRow = {
  id: string;
  code: string | null;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number | null;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const wholesaleImportRowSchema = z.object({
  code: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(100).optional(),
  price: z.number().int().positive().max(2147483647),
  stock: z.number().int().min(0).max(2147483647).nullable().optional(),
  available: z.boolean().optional(),
});

export const wholesaleImportSchema = z.array(wholesaleImportRowSchema).min(1).max(5000);

function ensureDatabase() {
  if (!hasDatabase) throw new NoDatabaseError();
}

function mapWholesale(row: WholesaleRow): WholesaleProduct {
  return {
    id: row.id,
    code: row.code ?? undefined,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    stock: row.stock,
    available: row.available,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Disponible para ofrecer: habilitado y con stock (o sin control de stock). */
export function isWholesaleInStock(product: Pick<WholesaleProduct, "available" | "stock">): boolean {
  return product.available && (product.stock === null || product.stock > 0);
}

export async function listWholesaleProducts(options?: { availableOnly?: boolean }): Promise<WholesaleProduct[]> {
  if (!hasDatabase) return [];
  const rows = await prisma.wholesaleProduct.findMany({
    where: options?.availableOnly ? { available: true } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(mapWholesale);
}

export async function saveWholesaleProduct(input: {
  id?: string;
  code?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number | null;
  available: boolean;
}): Promise<WholesaleProduct> {
  ensureDatabase();
  const data = {
    code: input.code?.trim() || null,
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    price: input.price,
    stock: input.stock,
    available: input.available,
  };
  const row = input.id
    ? await prisma.wholesaleProduct.update({ where: { id: input.id }, data })
    : await prisma.wholesaleProduct.create({ data });
  return mapWholesale(row);
}

export async function setWholesaleProductAvailable(id: string, available: boolean): Promise<void> {
  ensureDatabase();
  await prisma.wholesaleProduct.update({ where: { id }, data: { available } });
}

export async function deleteWholesaleProduct(id: string): Promise<void> {
  ensureDatabase();
  await prisma.wholesaleProduct.delete({ where: { id } });
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

/**
 * Alta o actualización masiva. Empareja por código y, si la fila no trae
 * código, por nombre (sin distinguir mayúsculas ni acentos). Todo el lote se
 * aplica en una transacción: un error no deja la lista a medio actualizar.
 */
export async function importWholesaleProducts(
  rows: (WholesaleImportRow & { available?: boolean })[]
): Promise<{ created: number; updated: number }> {
  ensureDatabase();
  const existing = await prisma.wholesaleProduct.findMany({ select: { id: true, code: true, name: true } });
  const byCode = new Map(existing.filter((item) => item.code).map((item) => [item.code as string, item.id]));
  const byName = new Map(existing.map((item) => [nameKey(item.name), item.id]));

  // Una fila repetida en el mismo lote reemplaza a la anterior.
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const code = row.code?.trim();
    unique.set(code ? `code:${code}` : `name:${nameKey(row.name)}`, row);
  }

  let created = 0;
  let updated = 0;
  const operations = [...unique.values()].map((row) => {
    const code = row.code?.trim() || undefined;
    const id = (code && byCode.get(code)) || byName.get(nameKey(row.name));
    const data = {
      name: row.name.trim(),
      price: row.price,
      ...(code ? { code } : {}),
      ...(row.description !== undefined ? { description: row.description.trim() } : {}),
      ...(row.category !== undefined ? { category: row.category.trim() } : {}),
      ...(row.stock !== undefined ? { stock: row.stock } : {}),
      ...(row.available !== undefined ? { available: row.available } : {}),
    };
    if (id) {
      updated++;
      return prisma.wholesaleProduct.update({ where: { id }, data });
    }
    created++;
    return prisma.wholesaleProduct.create({ data: { stock: null, ...data } });
  });

  await prisma.$transaction(operations);
  return { created, updated };
}
