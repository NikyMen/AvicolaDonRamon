import { prisma, hasDatabase } from "./prisma";
import { normalizePhone } from "./phone";
import { Prisma } from "@prisma/client";
import type {
  Product as DbProduct,
  Order as DbOrder,
  OrderItem as DbOrderItem,
  Customer as DbCustomer,
  Staff as DbStaff,
  DeliverySettings as DbDeliverySettings,
} from "@prisma/client";
import type {
  Product,
  Order,
  OrderItem,
  OrderStatus,
  Customer,
  Category,
  Novedad,
  SuperOferta,
  Staff,
  StaffRole,
  Coupon,
  CouponQuote,
  DeliverySettings,
  DeliveryQuote,
} from "./types";
import {
  products as mockProducts,
  customers as mockCustomers,
  orders as mockOrders,
  staff as mockStaff,
  categories,
} from "./data";
import { OTP_RESEND_MS, OTP_MAX_ATTEMPTS, isAdminPhone } from "./auth/otp";
import type { Role } from "./auth/session";
import { hashPassword, verifyPassword } from "./auth/password";
import { eventForStatus, notifyDeliveryReassignment, notifyOrderEvent } from "./n8n";
import { sucursales } from "./sucursales";
import { optimizeRoute, googleMapsRouteUrl, DEFAULT_ROUTE_ORIGIN } from "./route";
import { versionImageUrl } from "./image-url";
import { distanceKm } from "./geo";

/** Se lanza cuando una operación de escritura necesita base de datos y no hay. */
export class NoDatabaseError extends Error {
  constructor() {
    super("Operación no disponible: no hay base de datos configurada (DATABASE_URL).");
    this.name = "NoDatabaseError";
  }
}

/** Se lanza cuando un producto no tiene unidades suficientes para el pedido. */
export class OutOfStockError extends Error {
  constructor(productName: string, disponible: number) {
    super(
      disponible > 0
        ? `Nos quedan ${disponible} unidades de ${productName}. Ajustá la cantidad.`
        : `${productName} se quedó sin stock.`
    );
    this.name = "OutOfStockError";
  }
}

function ensureDb() {
  if (!hasDatabase) throw new NoDatabaseError();
}

/** Clientes creados en runtime cuando no hay DB (solo desarrollo local). */
const globalForRepo = globalThis as unknown as {
  runtimeCustomers?: Map<string, Customer>;
  runtimeOrders?: Map<string, Order>;
  runtimeSeq?: { n: number };
  runtimeArchivedProductIds?: Set<string>;
};
const runtimeCustomers = globalForRepo.runtimeCustomers ?? new Map<string, Customer>();
if (!globalForRepo.runtimeCustomers) globalForRepo.runtimeCustomers = runtimeCustomers;

/**
 * Pedidos en memoria para el modo sin base de datos (demo/pruebas). Persisten
 * mientras viva el proceso del server de desarrollo, así se puede recorrer todo
 * el flujo (pago → preparación → reparto → entregado) sin Postgres.
 */
const runtimeOrders = globalForRepo.runtimeOrders ?? new Map<string, Order>();
if (!globalForRepo.runtimeOrders) globalForRepo.runtimeOrders = runtimeOrders;
const runtimeSeq = globalForRepo.runtimeSeq ?? { n: 1042 };
if (!globalForRepo.runtimeSeq) globalForRepo.runtimeSeq = runtimeSeq;
const runtimeArchivedProductIds = globalForRepo.runtimeArchivedProductIds ?? new Set<string>();
if (!globalForRepo.runtimeArchivedProductIds) {
  globalForRepo.runtimeArchivedProductIds = runtimeArchivedProductIds;
}

/** Solo para el catálogo efímero de desarrollo sin PostgreSQL. */
export function isRuntimeProductArchived(id: string): boolean {
  return !hasDatabase && runtimeArchivedProductIds.has(id);
}

function runtimeCustomerId(phone: string) {
  return `guest-${phone}`;
}

// ---------- Mappers DB -> tipos públicos ----------
function mapProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    oldPrice: p.oldPrice ?? undefined,
    category: p.category as Category,
    image: versionImageUrl(p.image),
    badge: p.badge ?? undefined,
    dailyOffer: p.dailyOffer,
    available: p.available,
    stock: p.stock,
  };
}

function mapOrder(o: DbOrder & { items: DbOrderItem[] }): Order {
  return {
    id: o.code ?? `#${1000 + o.seq}`,
    internalId: o.id,
    checkoutId: o.checkoutId ?? undefined,
    customer: o.customerName,
    phone: o.phone ?? undefined,
    address: o.address ?? undefined,
    entrega: (o.entrega as Order["entrega"]) ?? undefined,
    deliverySlot: o.deliverySlot ?? undefined,
    deliveryDate: o.deliveryDate?.toISOString().slice(0, 10),
    lat: o.lat ?? undefined,
    lng: o.lng ?? undefined,
    deliveryCode: o.deliveryCode ?? undefined,
    deliveredAt: o.deliveredAt?.toISOString(),
    paidAt: o.paidAt?.toISOString(),
    cancelledAt: o.cancelledAt?.toISOString(),
    deliveryRetryAt: o.deliveryRetryAt?.toISOString(),
    mpPreferenceId: o.mpPreferenceId ?? undefined,
    mpInitPoint: o.mpInitPoint ?? undefined,
    mpPaymentId: o.mpPaymentId ?? undefined,
    couponReservedUntil: o.couponReservedUntil?.toISOString(),
    couponUsedAt: o.couponUsedAt?.toISOString(),
    shippingFee: o.shippingFee,
    shippingDistanceKm: o.shippingDistanceKm ?? undefined,
    shippingFreeReason: o.shippingFreeReason ?? undefined,
    routeSeq: o.routeSeq ?? undefined,
    dispatchedAt: o.dispatchedAt?.toISOString(),
    routeBatchId: o.routeBatchId ?? undefined,
    routeClosedAt: o.routeClosedAt?.toISOString(),
    updatedAt: o.updatedAt?.toISOString(),
    originSucursalId: o.originSucursalId ?? undefined,
    repartidorId: o.repartidorId ?? undefined,
    notes: o.notes ?? undefined,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
    })),
    total: o.total,
    discount: o.discount,
    couponCode: o.couponCode ?? undefined,
    status: o.status as OrderStatus,
    payment: o.payment,
    date: o.createdAt.toISOString(),
  };
}

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  pricePerKm: 500,
  freeAllSlots: false,
  freeSaturday: false,
  fixedSucursalId: "maipu",
};

function mapDeliverySettings(settings: DbDeliverySettings): DeliverySettings {
  return {
    pricePerKm: settings.pricePerKm,
    freeAllSlots: settings.freeAllSlots,
    freeSaturday: settings.freeSaturday,
    fixedSucursalId: settings.fixedSucursalId,
  };
}

function isSaturdayDelivery(date?: string): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === 6;
}

function deliveryOrigin(settings: DeliverySettings) {
  return (
    sucursales.find((s) => s.id === settings.fixedSucursalId) ??
    sucursales.find((s) => s.id === DEFAULT_DELIVERY_SETTINGS.fixedSucursalId) ??
    sucursales[0]
  );
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  if (!hasDatabase) return DEFAULT_DELIVERY_SETTINGS;
  const settings = await prisma.deliverySettings.upsert({
    where: { id: "main" },
    update: {},
    create: DEFAULT_DELIVERY_SETTINGS,
  });
  return mapDeliverySettings(settings);
}

export async function saveDeliverySettings(input: {
  pricePerKm: number;
  freeAllSlots: boolean;
  freeSaturday: boolean;
}): Promise<DeliverySettings> {
  ensureDb();
  const pricePerKm = Math.max(0, Math.round(input.pricePerKm));
  const settings = await prisma.deliverySettings.upsert({
    where: { id: "main" },
    update: {
      pricePerKm,
      freeAllSlots: input.freeAllSlots,
      freeSaturday: input.freeSaturday,
    },
    create: {
      ...DEFAULT_DELIVERY_SETTINGS,
      pricePerKm,
      freeAllSlots: input.freeAllSlots,
      freeSaturday: input.freeSaturday,
    },
  });
  return mapDeliverySettings(settings);
}

export async function quoteDelivery(input: {
  lat: number;
  lng: number;
  deliveryDate?: string;
}): Promise<DeliveryQuote> {
  const settings = await getDeliverySettings();
  const origin = deliveryOrigin(settings);
  const distance = distanceKm({ lat: origin.lat, lng: origin.lng }, { lat: input.lat, lng: input.lng });
  let freeReason: string | undefined;
  if (settings.freeAllSlots) freeReason = "Envio gratis configurado";
  else if (settings.freeSaturday && isSaturdayDelivery(input.deliveryDate)) {
    freeReason = "Envio gratis por entrega de sabado";
  }
  return {
    distanceKm: Number(distance.toFixed(2)),
    fee: freeReason ? 0 : Math.round(distance * settings.pricePerKm),
    freeReason,
    originSucursalId: origin.id,
    originName: origin.name,
  };
}

function mapCustomer(c: DbCustomer & { orders?: { total: number }[] }): Customer {
  const ords = c.orders ?? [];
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? "",
    phone: c.phone,
    document: c.document ?? undefined,
    orders: ords.length,
    spent: ords.reduce((a, o) => a + o.total, 0),
    joined: c.joinedAt.toISOString(),
  };
}

function mapStaff(s: DbStaff): Staff {
  return {
    id: s.id,
    name: s.name,
    role: s.role as StaffRole,
    phone: s.phone ?? undefined,
    email: s.email ?? undefined,
    username: s.username ?? undefined,
    hasPassword: Boolean(s.passwordHash),
    permissions: s.permissions ?? [],
    active: s.active,
    createdAt: s.createdAt.toISOString(),
  };
}

// ---------- Catálogo ----------
export interface ProductFilter {
  category?: Category;
  available?: boolean;
  search?: string;
}

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  if (hasDatabase) {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        category: f.category,
        available: f.available,
        ...(f.search
          ? {
              OR: [
                { name: { contains: f.search, mode: "insensitive" } },
                { description: { contains: f.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapProduct);
  }
  return mockProducts.filter((p) => {
    if (runtimeArchivedProductIds.has(p.id)) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.available !== undefined && p.available !== f.available) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q))
        return false;
    }
    return true;
  }).map((p) => ({ ...p, image: versionImageUrl(p.image) }));
}

export async function getProduct(id: string): Promise<Product | null> {
  if (hasDatabase) {
    const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
    return p ? mapProduct(p) : null;
  }
  if (runtimeArchivedProductIds.has(id)) return null;
  const product = mockProducts.find((p) => p.id === id);
  return product ? { ...product, image: versionImageUrl(product.image) } : null;
}

export async function listOffers(): Promise<Product[]> {
  if (hasDatabase) {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [{ oldPrice: { not: null } }, { dailyOffer: true }],
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapProduct);
  }
  return mockProducts
    .filter(
      (p) =>
        !runtimeArchivedProductIds.has(p.id) &&
        (p.dailyOffer || p.oldPrice != null || p.badge === "Promo del día")
    )
    .map((p) => ({ ...p, image: versionImageUrl(p.image) }));
}

export function listCategories() {
  return categories;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  category: Category;
  image: string;
  badge?: string | null;
  dailyOffer?: boolean;
  available?: boolean;
  stock?: number;
}

/** Crea un producto. El id se deriva del nombre (slug) si no se pasa. */
export async function createProduct(input: ProductInput & { id?: string }): Promise<Product> {
  ensureDb();
  const id =
    input.id ??
    input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const data = {
    name: input.name,
    description: input.description,
    price: input.price,
    oldPrice: input.oldPrice ?? null,
    category: input.category,
    image: input.image,
    badge: input.badge ?? null,
    dailyOffer: input.dailyOffer ?? false,
    available: input.available ?? true,
    stock: input.stock ?? 0,
  };
  const existing = await prisma.product.findUnique({ where: { id } });
  const p = existing?.deletedAt
    ? await prisma.product.update({ where: { id }, data: { ...data, deletedAt: null } })
    : await prisma.product.create({ data: { id, ...data } });
  return mapProduct(p);
}

/** Actualiza campos sueltos de un producto (precio, imagen, etc.). */
export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<Product | null> {
  ensureDb();
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;
  const p = await prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      price: input.price,
      oldPrice: input.oldPrice === undefined ? undefined : input.oldPrice,
      category: input.category,
      image: input.image,
      badge: input.badge === undefined ? undefined : input.badge,
      dailyOffer: input.dailyOffer,
      available: input.available,
      stock: input.stock,
    },
  });
  return mapProduct(p);
}

/**
 * Archiva un producto y desactiva promociones que ya no pueden venderlo.
 * Conserva la fila para no romper pedidos, cupones ni analítica histórica.
 */
export async function deleteProduct(id: string): Promise<Product | null> {
  if (!hasDatabase) {
    const product = mockProducts.find((item) => item.id === id);
    if (!product || runtimeArchivedProductIds.has(id)) return null;
    runtimeArchivedProductIds.add(id);
    return { ...product, image: versionImageUrl(product.image) };
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;

    await Promise.all([
      tx.coupon.updateMany({
        where: { OR: [{ discountProductId: id }, { giftProductId: id }] },
        data: { active: false },
      }),
      tx.superOferta.updateMany({ where: { cartProductId: id }, data: { active: false } }),
    ]);

    const archived = await tx.product.update({
      where: { id },
      data: { deletedAt: new Date(), available: false, stock: 0, dailyOffer: false },
    });
    return mapProduct(archived);
  });
}

// ---------- Cupones ----------
type CouponRow = Awaited<ReturnType<typeof prisma.coupon.findFirst>> & {
  discountProduct?: { id: string; name: string } | null;
  giftProduct?: { id: string; name: string } | null;
};

function mapCoupon(c: NonNullable<CouponRow>): Coupon {
  return {
    id: c.id,
    code: c.code,
    kind: c.kind === "second_unit" || c.kind === "three_for_two" ? c.kind : "coupon",
    automatic: c.automatic,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    discountPercent: c.discountPercent,
    discountProductId: c.discountProductId ?? undefined,
    discountProductName: c.discountProduct?.name,
    giftProductId: c.giftProductId ?? undefined,
    giftProductName: c.giftProduct?.name,
    giftQty: c.giftQty,
    firstPurchaseOnly: c.firstPurchaseOnly,
    oncePerPhone: c.oncePerPhone,
    active: c.active,
  };
}

const couponInclude = {
  discountProduct: { select: { id: true, name: true } },
  giftProduct: { select: { id: true, name: true } },
} as const;

export async function listCoupons(): Promise<Coupon[]> {
  if (!hasDatabase) return [];
  const rows = await prisma.coupon.findMany({ include: couponInclude, orderBy: { createdAt: "desc" } });
  return rows.map((row) => mapCoupon(row));
}

export interface CouponInput {
  code: string;
  kind: Coupon["kind"];
  automatic: boolean;
  maxUses: number;
  discountPercent: number;
  discountProductId?: string | null;
  giftProductId?: string | null;
  giftQty: number;
  firstPurchaseOnly: boolean;
  oncePerPhone: boolean;
  active: boolean;
}

export async function saveCoupon(id: string | undefined, input: CouponInput): Promise<Coupon> {
  ensureDb();
  const data = { ...input, code: input.code.trim().toUpperCase() };
  const row = id
    ? await prisma.coupon.update({ where: { id }, data, include: couponInclude })
    : await prisma.coupon.create({ data, include: couponInclude });
  return mapCoupon(row);
}

export async function deleteCoupon(id: string): Promise<void> {
  ensureDb();
  await prisma.coupon.delete({ where: { id } });
}

export class CouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponError";
  }
}

type QuoteLine = { productId: string; name: string; qty: number; price: number };
const COUPON_RESERVATION_MS = 60_000;
const PAID_ORDER_STATUSES: OrderStatus[] = ["en_preparacion", "en_camino", "entregado"];

async function claimCouponUse(
  tx: Prisma.TransactionClient,
  couponId: string
): Promise<void> {
  // La comparación y el incremento ocurren en una sola operación bajo el
  // bloqueo de la fila: un pago tardío no puede llevar usedCount por encima
  // de maxUses aunque haya otro pago confirmado al mismo tiempo.
  const claimed = await tx.$executeRaw`
    UPDATE "Coupon"
    SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${couponId}
      AND "usedCount" < "maxUses"
  `;
  if (claimed !== 1) {
    throw new CouponError("Este cupón ya agotó sus usos disponibles.");
  }
}

async function countActiveCouponReservations(couponId: string, now = new Date()): Promise<number> {
  return prisma.order.count({
    where: {
      couponId,
      status: "pendiente",
      couponUsedAt: null,
      couponReservedUntil: { gt: now },
    },
  });
}

async function reserveCouponSlot(
  tx: Prisma.TransactionClient,
  couponId: string,
  phone: string | undefined,
  now: Date
): Promise<void> {
  // Todas las altas de reservas de este cupón pasan por el mismo bloqueo, así
  // dos checkouts simultáneos no pueden quedarse con el último uso.
  await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${couponId} FOR UPDATE`;
  const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
  if (!coupon || !coupon.active) {
    throw new CouponError("El cupón no existe o no está activo.");
  }

  const reservations = await tx.order.count({
    where: {
      couponId,
      status: "pendiente",
      couponUsedAt: null,
      couponReservedUntil: { gt: now },
    },
  });
  if (coupon.usedCount + reservations >= coupon.maxUses) {
    throw new CouponError("Este cupón ya agotó sus usos disponibles.");
  }

  if (coupon.firstPurchaseOnly) {
    if (!phone) {
      throw new CouponError("Completá tu WhatsApp para usar el código de bienvenida.");
    }
    const previousOrReserved = await tx.order.count({
      where: {
        phone,
        OR: [
          { status: { in: PAID_ORDER_STATUSES } },
          {
            couponId,
            status: "pendiente",
            couponUsedAt: null,
            couponReservedUntil: { gt: now },
          },
        ],
      },
    });
    if (previousOrReserved > 0) {
      throw new CouponError("El código de bienvenida es solo para tu primera compra.");
    }
  }

  if (coupon.oncePerPhone) {
    if (!phone) {
      throw new CouponError("Completá tu WhatsApp para usar este cupón.");
    }
    const previousOrReserved = await tx.order.count({
      where: {
        phone,
        couponId,
        OR: [
          { couponUsedAt: { not: null } },
          {
            status: "pendiente",
            couponUsedAt: null,
            couponReservedUntil: { gt: now },
          },
        ],
      },
    });
    if (previousOrReserved > 0) {
      throw new CouponError("Este cupón se puede usar una sola vez por número de teléfono.");
    }
  }
}

async function releaseExpiredCouponReservations(): Promise<void> {
  if (!hasDatabase) return;
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: "pendiente",
      mpPaymentId: null,
      couponUsedAt: null,
      couponReservedUntil: { lte: now },
    },
    include: { items: true },
    take: 100,
  });

  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      const released = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "pendiente",
          mpPaymentId: null,
          couponUsedAt: null,
          couponReservedUntil: { lte: now },
        },
        data: {
          status: "no_pagado",
          cancelledAt: now,
          couponReservedUntil: null,
        },
      });
      if (released.count !== 1) return;
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
    });
  }
}

/**
 * Resuelve un cupón contra los renglones del pedido. `phone` (ya normalizado)
 * es obligatorio para los cupones de bienvenida: son de un solo uso por número,
 * así que se chequea que ese teléfono no tenga compras anteriores.
 */
async function resolveCoupon(code: string, lines: QuoteLine[], phone?: string) {
  ensureDb();
  const normalized = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized }, include: couponInclude });
  if (!coupon || !coupon.active) throw new CouponError("El cupón no existe o no está activo.");
  const reservations = await countActiveCouponReservations(coupon.id);
  if (coupon.usedCount + reservations >= coupon.maxUses) {
    throw new CouponError("Este cupón ya agotó sus usos disponibles.");
  }

  if (coupon.firstPurchaseOnly) {
    if (!phone) {
      throw new CouponError("Completá tu WhatsApp para usar el código de bienvenida.");
    }
    const previas = await prisma.order.count({
      // Un intento de checkout pendiente no es una compra. Solo bloqueamos el
      // cupón cuando Mercado Pago ya confirmó el pedido.
      where: { phone, status: { in: PAID_ORDER_STATUSES } },
    });
    if (previas > 0) {
      throw new CouponError("El código de bienvenida es solo para tu primera compra.");
    }
  }

  if (coupon.oncePerPhone) {
    if (!phone) {
      throw new CouponError("Completá tu WhatsApp para usar este cupón.");
    }
    const previousUse = await prisma.order.count({
      where: { phone, couponId: coupon.id, couponUsedAt: { not: null } },
    });
    if (previousUse > 0) {
      throw new CouponError("Este cupón se puede usar una sola vez por número de teléfono.");
    }
  }

  const eligible = coupon.discountProductId
    ? lines.filter((line) => line.productId === coupon.discountProductId)
    : lines;
  let discount = 0;
  if (coupon.kind === "second_unit") {
    const line = eligible[0];
    if (!line || line.qty < 2) {
      throw new CouponError("Sumá al menos 2 unidades del producto para aplicar esta promo.");
    }
    // Cada par activa una vez la promo: en 2 unidades se bonifica 1; en 4,
    // 2; y así sucesivamente. Las unidades impares restantes se cobran normal.
    discount = Math.floor(line.qty / 2) * Math.round((line.price * coupon.discountPercent) / 100);
  } else if (coupon.kind === "three_for_two") {
    const line = eligible[0];
    if (!line || line.qty < 3) {
      throw new CouponError("Sumá al menos 3 unidades del producto para aplicar este cupón.");
    }
    discount = Math.floor(line.qty / 3) * line.price;
  } else {
    if (coupon.discountPercent > 0 && eligible.length === 0) {
      throw new CouponError("El cupón no aplica a los productos del carrito.");
    }
    const eligibleTotal = eligible.reduce((sum, line) => sum + line.qty * line.price, 0);
    discount = Math.round((eligibleTotal * coupon.discountPercent) / 100);
  }
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const gift = coupon.giftProduct
    ? { productId: coupon.giftProduct.id, name: coupon.giftProduct.name, qty: coupon.giftQty }
    : undefined;
  const parts: string[] = [];
  if (coupon.kind === "three_for_two") {
    parts.push(`3x2 en ${coupon.discountProduct?.name ?? "este producto"}`);
  } else if (coupon.discountPercent > 0) {
    parts.push(
      coupon.kind === "second_unit"
        ? `${coupon.discountPercent}% en la segunda unidad de ${coupon.discountProduct?.name ?? "este producto"}`
        : `${coupon.discountPercent}% de descuento${coupon.discountProduct ? ` en ${coupon.discountProduct.name}` : ""}`
    );
  }
  if (gift) parts.push(`${gift.qty}x ${gift.name} de regalo`);
  return {
    coupon,
    quote: {
      code: coupon.code,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      description: parts.join(" + "),
      automatic: coupon.automatic,
      gift,
    } satisfies CouponQuote,
  };
}

/** Elige la mejor promo automática aplicable al carrito. */
export async function quoteAutomaticCoupon(
  items: { productId: string; qty: number }[]
): Promise<CouponQuote | null> {
  if (!hasDatabase) return null;
  await releaseExpiredCouponReservations();
  const { lines } = await quoteOrder(items);
  const rules = await prisma.coupon.findMany({
    where: {
      active: true,
      automatic: true,
      kind: "second_unit",
      discountProductId: { not: null },
    },
    include: couponInclude,
    orderBy: { createdAt: "desc" },
  });

  let best: CouponQuote | null = null;
  for (const rule of rules) {
    try {
      const quote = (await resolveCoupon(rule.code, lines)).quote;
      if (!best || quote.discount > best.discount) best = quote;
    } catch (error) {
      // Una regla que no aplica, está agotada o no tiene dos unidades no
      // debe impedir que se evalúen las demás promociones automáticas.
      if (!(error instanceof CouponError)) throw error;
    }
  }
  return best;
}

export async function quoteCoupon(
  code: string,
  items: { productId: string; qty: number }[],
  phone?: string
): Promise<CouponQuote> {
  await releaseExpiredCouponReservations();
  const { lines } = await quoteOrder(items);
  const normalizado = phone?.trim() ? normalizePhone(phone) : undefined;
  return (await resolveCoupon(code, lines, normalizado)).quote;
}

// ---------- Novedades (banners de la home) ----------

/** Novedades por defecto cuando no hay base de datos (o está vacía). */
const defaultNovedades: Novedad[] = [
  { id: "nov-1", image: "/2.jpeg", title: "Día del Padre", active: true, position: 0 },
  { id: "nov-2", image: "/4.jpeg", title: "Compartí en familia", active: true, position: 1 },
];

function mapNovedad(n: {
  id: string;
  title: string | null;
  image: string;
  link: string | null;
  active: boolean;
  position: number;
}): Novedad {
  return {
    id: n.id,
    title: n.title ?? undefined,
    image: versionImageUrl(n.image),
    link: n.link ?? undefined,
    active: n.active,
    position: n.position,
  };
}

export async function listNovedades(onlyActive = false): Promise<Novedad[]> {
  if (hasDatabase) {
    const rows = await prisma.novedad.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapNovedad);
  }
  const novedades = onlyActive ? defaultNovedades.filter((n) => n.active) : defaultNovedades;
  return novedades.map((n) => ({ ...n, image: versionImageUrl(n.image) }));
}

export interface NovedadInput {
  title?: string | null;
  image: string;
  link?: string | null;
  active?: boolean;
  position?: number;
}

export async function createNovedad(input: NovedadInput): Promise<Novedad> {
  ensureDb();
  const n = await prisma.novedad.create({
    data: {
      title: input.title ?? null,
      image: input.image,
      link: input.link ?? null,
      active: input.active ?? true,
      position: input.position ?? 0,
    },
  });
  return mapNovedad(n);
}

export async function updateNovedad(
  id: string,
  input: Partial<NovedadInput>
): Promise<Novedad | null> {
  ensureDb();
  const existing = await prisma.novedad.findUnique({ where: { id } });
  if (!existing) return null;
  const n = await prisma.novedad.update({
    where: { id },
    data: {
      title: input.title === undefined ? undefined : input.title,
      image: input.image,
      link: input.link === undefined ? undefined : input.link,
      active: input.active,
      position: input.position,
    },
  });
  return mapNovedad(n);
}

export async function deleteNovedad(id: string): Promise<boolean> {
  ensureDb();
  try {
    await prisma.novedad.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Super Oferta (banner principal de la home) ----------

/**
 * Super oferta por defecto: se muestra cuando no hay base de datos o cuando
 * todavía no se editó desde el panel. Los valores se pisan al guardar.
 */
const defaultSuperOferta: SuperOferta = {
  id: "main",
  title: "Caja de Patamuslo 10kg",
  subtitle: "Stock limitado para aprovechar hoy.",
  price: 28500,
  oldPrice: 34000,
  image: "/super-oferta-patamuslo-10kg.png",
  link: "/productos",
  cartProductId: "p-medallones-1kg",
  cartQuantity: 2,
  active: true,
};

function mapSuperOferta(s: {
  id: string;
  title: string;
  subtitle: string | null;
  price: number;
  oldPrice: number | null;
  image: string;
  video: string | null;
  link: string | null;
  cartProductId: string;
  cartQuantity: number;
  active: boolean;
}): SuperOferta {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle ?? undefined,
    price: s.price,
    oldPrice: s.oldPrice ?? undefined,
    image: versionImageUrl(s.image),
    video: s.video ?? undefined,
    link: s.link ?? undefined,
    cartProductId: s.cartProductId,
    cartQuantity: s.cartQuantity,
    active: s.active,
  };
}

export async function getSuperOferta(): Promise<SuperOferta> {
  if (hasDatabase) {
    const row = await prisma.superOferta.findUnique({ where: { id: "main" } });
    if (row) return mapSuperOferta(row);
  }
  return { ...defaultSuperOferta, image: versionImageUrl(defaultSuperOferta.image) };
}

export interface SuperOfertaInput {
  title: string;
  subtitle?: string | null;
  price: number;
  oldPrice?: number | null;
  image: string;
  video?: string | null;
  link?: string | null;
  cartProductId?: string;
  cartQuantity?: number;
  active?: boolean;
}

export async function upsertSuperOferta(input: SuperOfertaInput): Promise<SuperOferta> {
  ensureDb();
  const data = {
    title: input.title,
    subtitle: input.subtitle ?? null,
    price: input.price,
    oldPrice: input.oldPrice ?? null,
    image: input.image,
    video: input.video ?? null,
    link: input.link ?? null,
    cartProductId: input.cartProductId ?? "p-medallones-1kg",
    cartQuantity: input.cartQuantity ?? 2,
    active: input.active ?? true,
  };
  const s = await prisma.superOferta.upsert({
    where: { id: "main" },
    update: data,
    create: { id: "main", ...data },
  });
  return mapSuperOferta(s);
}

// ---------- Pedidos ----------
export interface OrderFilter {
  status?: OrderStatus;
  statusIn?: OrderStatus[];
  statusNot?: OrderStatus;
  customerId?: string;
  limit?: number;
}

export async function listOrders(f: OrderFilter = {}): Promise<Order[]> {
  if (hasDatabase) {
    await releaseExpiredCouponReservations();
    const rows = await prisma.order.findMany({
      where: {
        status:
          f.status ??
          (f.statusIn ? { in: f.statusIn } : f.statusNot ? { not: f.statusNot } : undefined),
        customerId: f.customerId,
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: f.limit,
    });
    return rows.map(mapOrder);
  }
  // Sin DB: pedidos en memoria (demo) primero, más nuevos arriba, luego mocks.
  const runtime = [...runtimeOrders.values()].sort((a, b) => b.date.localeCompare(a.date));
  let list = [...runtime, ...mockOrders];
  if (f.status) list = list.filter((o) => o.status === f.status);
  if (f.statusIn) list = list.filter((o) => f.statusIn?.includes(o.status));
  if (f.statusNot) list = list.filter((o) => o.status !== f.statusNot);
  if (f.limit) list = list.slice(0, f.limit);
  return list;
}

/**
 * Pedidos por id interno o código (#1043), para la vista de etiquetas.
 * Devuelve en orden de ruta (routeSeq) y, sin ruta, en el orden pedido.
 */
export async function listOrdersByIds(ids: string[]): Promise<Order[]> {
  const wanted = ids.filter(Boolean);
  if (wanted.length === 0) return [];
  let list: Order[];
  if (hasDatabase) {
    const rows = await prisma.order.findMany({
      where: { OR: [{ id: { in: wanted } }, { code: { in: wanted } }] },
      include: { items: true },
    });
    list = rows.map(mapOrder);
  } else {
    const all = [...runtimeOrders.values(), ...mockOrders];
    const set = new Set(wanted);
    list = all.filter((o) => set.has(o.id) || (o.internalId != null && set.has(o.internalId)));
  }
  const pos = new Map(wanted.map((id, i) => [id, i]));
  const posOf = (o: Order) => pos.get(o.internalId ?? "") ?? pos.get(o.id) ?? 0;
  return list.sort(
    (a, b) => (a.routeSeq ?? Infinity) - (b.routeSeq ?? Infinity) || posOf(a) - posOf(b)
  );
}

export async function getOrder(idOrCode: string): Promise<Order | null> {
  if (hasDatabase) {
    const o = await prisma.order.findFirst({
      where: { OR: [{ code: idOrCode }, { id: idOrCode }] },
      include: { items: true },
    });
    return o ? mapOrder(o) : null;
  }
  return (
    runtimeOrders.get(idOrCode) ??
    [...runtimeOrders.values()].find((o) => o.id === idOrCode) ??
    mockOrders.find((o) => o.id === idOrCode) ??
    null
  );
}

export interface CreateOrderInput {
  /** Clave estable del intento para que los reintentos no dupliquen pedidos. */
  checkoutId?: string;
  customerId?: string;
  customer?: { name: string; phone: string; email?: string; document?: string };
  // name/price son opcionales: se usan como respaldo en el modo sin DB (demo).
  items: { productId: string; qty: number; name?: string; price?: number }[];
  payment: Order["payment"];
  address?: string;
  notes?: string;
  entrega?: Order["entrega"];
  /** Rango horario de entrega ("08-12" o "17-20"). */
  deliverySlot?: string;
  /** Fecha calendario estimada de entrega en Argentina (YYYY-MM-DD). */
  deliveryDate?: string;
  lat?: number;
  lng?: number;
  couponCode?: string;
}

/**
 * Resuelve los renglones de un pedido contra el catálogo real y calcula el
 * total en el servidor (nunca se confía en los precios del cliente).
 * La usan createOrder y el checkout de Mercado Pago (para validar el mínimo
 * de envío antes de crear nada).
 */
export async function quoteOrder(
  items: { productId: string; qty: number }[]
): Promise<{ lines: { productId: string; name: string; qty: number; price: number }[]; total: number }> {
  ensureDb();
  const ids = items.map((i) => i.productId);
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: null },
  });
  const byId = new Map(dbProducts.map((p) => [p.id, p]));

  const lines = items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new Error(`Producto inexistente: ${i.productId}`);
    if (i.qty <= 0) throw new Error(`Cantidad inválida para ${p.name}`);
    if (!p.available || p.stock <= 0) throw new OutOfStockError(p.name, 0);
    if (p.stock < i.qty) throw new OutOfStockError(p.name, p.stock);
    return { productId: p.id, name: p.name, qty: i.qty, price: p.price };
  });
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  return { lines, total };
}

/** Código de entrega de 4 dígitos que el cliente le da al repartidor. */
function generateDeliveryCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Cotiza los renglones en el modo sin DB (demo). Usa el producto de ejemplo si
 * existe y, si no, el name/price que mandó el carrito. No lanza si el catálogo
 * no tiene el producto: así la demo funciona con cualquier ítem.
 */
async function quoteOrderMem(
  items: { productId: string; qty: number; name?: string; price?: number }[]
): Promise<{ lines: OrderItem[]; total: number }> {
  const lines: OrderItem[] = [];
  for (const i of items) {
    if (runtimeArchivedProductIds.has(i.productId)) {
      throw new Error(`Producto inexistente: ${i.productId}`);
    }
    const p = await getProduct(i.productId);
    const name = p?.name ?? i.name ?? i.productId;
    const price = p?.price ?? i.price ?? 0;
    if (p && (!p.available || p.stock <= 0)) throw new OutOfStockError(name, 0);
    if (p && p.stock < i.qty) throw new OutOfStockError(name, p.stock);
    lines.push({ productId: i.productId, name, qty: i.qty, price });
  }
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  return { lines, total };
}

/** Alta de pedido en memoria (demo sin base de datos). */
async function createOrderMem(input: CreateOrderInput): Promise<Order> {
  if (input.checkoutId) {
    const existing = [...runtimeOrders.values()].find((o) => o.checkoutId === input.checkoutId);
    if (existing) return existing;
  }
  const { lines, total: subtotal } = await quoteOrderMem(input.items);
  const deliveryQuote =
    input.entrega === "envio" && input.lat != null && input.lng != null
      ? await quoteDelivery({ lat: input.lat, lng: input.lng, deliveryDate: input.deliveryDate })
      : null;
  const total = subtotal + (deliveryQuote?.fee ?? 0);
  runtimeSeq.n += 1;
  const internalId = `mem-${runtimeSeq.n}`;
  const order: Order = {
    id: `#${runtimeSeq.n}`,
    internalId,
    checkoutId: input.checkoutId,
    customer: input.customer?.name ?? "Cliente",
    phone: input.customer ? normalizePhone(input.customer.phone) : undefined,
    address: input.address,
    entrega: input.entrega,
    deliverySlot: input.deliverySlot,
    deliveryDate: input.deliveryDate,
    lat: input.lat,
    lng: input.lng,
    deliveryCode: generateDeliveryCode(),
    notes: input.notes,
    items: lines,
    total,
    shippingFee: deliveryQuote?.fee ?? 0,
    shippingDistanceKm: deliveryQuote?.distanceKm,
    shippingFreeReason: deliveryQuote?.freeReason,
    status: "pendiente",
    payment: input.payment,
    date: new Date().toISOString(),
  };
  runtimeOrders.set(internalId, order);
  return order;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!hasDatabase) return createOrderMem(input);

  if (input.checkoutId) {
    const existing = await prisma.order.findUnique({
      where: { checkoutId: input.checkoutId },
      include: { items: true },
    });
    if (existing) return mapOrder(existing);
  }

  await releaseExpiredCouponReservations();
  const { lines, total: subtotal } = await quoteOrder(input.items);

  // Resolver / crear cliente. El teléfono se normaliza SIEMPRE antes del
  // upsert: es la clave que asocia la compra con el cliente, y si se guarda
  // como lo tipeó la persona ("+54 379…" vs "0379 15…") el mismo cliente
  // termina duplicado y su historial de compras partido en dos.
  let customerId = input.customerId ?? null;
  let customerName = input.customer?.name ?? "Cliente";
  const phone = input.customer ? normalizePhone(input.customer.phone) : undefined;
  // Teléfono con el que se chequean los cupones de un uso por número: el que
  // vino en el pedido o, si se pidió con customerId, el del cliente guardado.
  let customerPhone = phone;
  if (!customerId && input.customer) {
    const c = await prisma.customer.upsert({
      where: { phone: phone! },
      update: {
        name: input.customer.name,
        email: input.customer.email ?? undefined,
        document: input.customer.document ?? undefined,
      },
      create: {
        name: input.customer.name,
        phone: phone!,
        email: input.customer.email ?? null,
        document: input.customer.document ?? null,
      },
    });
    customerId = c.id;
    customerName = c.name;
  } else if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new Error(`Cliente inexistente: ${customerId}`);
    customerName = c.name;
    customerPhone = c.phone;
  }

  // El cupón se resuelve con el teléfono ya normalizado: los códigos de
  // bienvenida valen una sola vez por número.
  const couponResult = input.couponCode
    ? await resolveCoupon(input.couponCode, lines, customerPhone)
    : null;
  const discount = couponResult?.quote.discount ?? 0;
  const deliveryQuote =
    input.entrega === "envio" && input.lat != null && input.lng != null
      ? await quoteDelivery({ lat: input.lat, lng: input.lng, deliveryDate: input.deliveryDate })
      : null;
  const total = Math.max(0, subtotal - discount) + (deliveryQuote?.fee ?? 0);
  const orderLines = couponResult?.quote.gift
    ? [...lines, { ...couponResult.quote.gift, price: 0 }]
    : lines;
  const couponReservedUntil = couponResult
    ? new Date(Date.now() + COUPON_RESERVATION_MS)
    : null;

  const createData = {
      checkoutId: input.checkoutId ?? null,
      customerId,
      customerName,
      phone,
      address: input.address,
      notes: input.notes,
      entrega: input.entrega ?? null,
      deliverySlot: input.deliverySlot ?? null,
      deliveryDate: input.deliveryDate
        ? new Date(`${input.deliveryDate}T00:00:00.000Z`)
        : null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      // El cliente le da este código al repartidor al recibir el pedido.
      deliveryCode: generateDeliveryCode(),
      total,
      discount,
      shippingFee: deliveryQuote?.fee ?? 0,
      shippingDistanceKm: deliveryQuote?.distanceKm ?? null,
      shippingFreeReason: deliveryQuote?.freeReason ?? null,
      couponId: couponResult?.coupon.id ?? null,
      couponCode: couponResult?.coupon.code ?? null,
      couponReservedUntil,
      payment: input.payment,
      items: { create: orderLines },
  };

  // Todo junto y atómico: descontar stock (incluido el regalo), reservar el
  // cupón por un minuto y crear el pedido. Si algo no da, no se crea nada y no se pierde
  // stock. El `where` con `stock: { gte: qty }` es lo que evita sobrevender
  // cuando dos personas compran la última unidad a la vez.
  let created: DbOrder & { items: DbOrderItem[] };
  try {
    created = await prisma.$transaction(async (tx) => {
      if (couponResult) {
        await reserveCouponSlot(tx, couponResult.coupon.id, customerPhone, new Date());
      }

      for (const line of orderLines) {
        const claimed = await tx.product.updateMany({
          where: {
            id: line.productId,
            deletedAt: null,
            available: true,
            stock: { gte: line.qty },
          },
          data: { stock: { decrement: line.qty } },
        });
        if (claimed.count !== 1) {
          const actual = await tx.product.findUnique({
            where: { id: line.productId },
            select: { stock: true },
          });
          throw new OutOfStockError(line.name, actual?.stock ?? 0);
        }
      }

      return tx.order.create({ data: createData, include: { items: true } });
    });
  } catch (error) {
    // Dos requests simultáneos con la misma clave pueden superar la lectura
    // inicial. El índice único decide cuál crea; el otro reutiliza ese pedido.
    if (
      input.checkoutId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.order.findUnique({
        where: { checkoutId: input.checkoutId },
        include: { items: true },
      });
      if (existing) return mapOrder(existing);
    }
    throw error;
  }

  const withCode = await prisma.order.update({
    where: { id: created.id },
    data: { code: `#${1000 + created.seq}` },
    include: { items: true },
  });

  return mapOrder(withCode);
}

/** Conserva la preferencia para que un reintento vuelva al mismo checkout. */
export async function saveMercadoPagoPreference(
  idOrCode: string,
  preference: { id: string; initPoint: string }
): Promise<Order | null> {
  if (!hasDatabase) {
    const order = findMemOrder(idOrCode);
    if (!order) return null;
    if (!order.mpPreferenceId) {
      order.mpPreferenceId = preference.id;
      order.mpInitPoint = preference.initPoint;
    }
    return order;
  }

  ensureDb();
  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: { items: true },
  });
  if (!existing) return null;
  if (existing.mpPreferenceId) return mapOrder(existing);

  await prisma.order.updateMany({
    where: { id: existing.id, mpPreferenceId: null },
    data: {
      mpPreferenceId: preference.id,
      mpInitPoint: preference.initPoint,
    },
  });
  const updated = await prisma.order.findUnique({
    where: { id: existing.id },
    include: { items: true },
  });
  return updated ? mapOrder(updated) : null;
}

export interface VerifiedMercadoPagoPayment {
  id: string;
  status: string;
}

/**
 * Aplica un pago ya verificado contra Mercado Pago.
 *
 * - Un pago rechazado marca como no pagado un checkout todavía pendiente.
 * - Un segundo pago nunca pisa el pago aprobado que ya quedó ligado.
 * - Un webhook viejo no hace retroceder un pedido confirmado.
 * - Reintentos del mismo evento son idempotentes y no duplican stock/avisos.
 */
export async function applyVerifiedMercadoPagoPayment(
  idOrCode: string,
  payment: VerifiedMercadoPagoPayment
): Promise<Order | null> {
  const approved = payment.status === "approved";
  const failed = payment.status === "rejected" || payment.status === "cancelled";
  const reversed = payment.status === "refunded" || payment.status === "charged_back";

  if (!hasDatabase) {
    const order = findMemOrder(idOrCode);
    if (!order) return null;
    const previousStatus = order.status;
    const now = new Date().toISOString();

    if (approved && (!order.mpPaymentId || order.mpPaymentId === payment.id)) {
      if (!order.mpPaymentId && !["en_camino", "entregado"].includes(order.status)) {
        order.status = "en_preparacion";
      }
      order.mpPaymentId = payment.id;
      order.paidAt ??= now;
      order.cancelledAt = undefined;
      order.couponReservedUntil = undefined;
      if (order.couponCode) order.couponUsedAt ??= now;
    } else if (
      (failed && !order.mpPaymentId && order.status === "pendiente") ||
      (reversed && order.mpPaymentId === payment.id && order.status !== "cancelado")
    ) {
      order.status = failed ? "no_pagado" : "cancelado";
      order.cancelledAt ??= now;
      order.couponReservedUntil = undefined;
      if (reversed) order.couponUsedAt = undefined;
    }

    if (order.status !== previousStatus) {
      order.updatedAt = now;
      const event = eventForStatus(order.status);
      if (event) await notifyOrderEvent(event, order);
    }
    return order;
  }

  ensureDb();
  let statusChanged = false;
  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${idOrCode} OR "code" = ${idOrCode}
      LIMIT 1
      FOR UPDATE
    `;
    if (!locked[0]) return null;
    const current = await tx.order.findUnique({
      where: { id: locked[0].id },
      include: { items: true },
    });
    if (!current) return null;

    const now = new Date();
    if (approved) {
      // Si ya hay otro pago aprobado, esta notificación pertenece a un segundo
      // intento y no puede modificar el pedido.
      if (current.mpPaymentId && current.mpPaymentId !== payment.id) return current;
      if (current.mpPaymentId === payment.id) return current;

      if (current.couponId && !current.couponUsedAt) {
        await claimCouponUse(tx, current.couponId);
      }

      const nextStatus =
        current.status === "pendiente" ||
        current.status === "no_pagado" ||
        current.status === "cancelado"
          ? "en_preparacion"
          : current.status;
      const claimed = await tx.order.updateMany({
        where: {
          id: current.id,
          status: current.status,
          mpPaymentId: null,
        },
        data: {
          status: nextStatus,
          mpPaymentId: payment.id,
          paidAt: current.paidAt ?? now,
          cancelledAt: null,
          couponReservedUntil: null,
          couponUsedAt: current.couponId ? (current.couponUsedAt ?? now) : null,
          deliveryRetryAt: null,
        },
      });
      if (claimed.count !== 1) {
        return tx.order.findUnique({ where: { id: current.id }, include: { items: true } });
      }

      // Si el pago se acreditó después de una cancelación, el dinero manda:
      // volvemos a reservar el pedido aun si eso deja stock negativo, para no
      // ocultar una venta cobrada que requiere resolución operativa.
      if (current.status === "cancelado" || current.status === "no_pagado") {
        for (const item of current.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          });
        }
      }
      statusChanged = nextStatus !== current.status;
    } else {
      const canClose =
        (failed && !current.mpPaymentId && current.status === "pendiente") ||
        (reversed && current.mpPaymentId === payment.id && current.status !== "cancelado");
      if (!canClose) return current;
      const nextStatus: OrderStatus = failed ? "no_pagado" : "cancelado";

      const claimed = await tx.order.updateMany({
        where: reversed
          ? {
              id: current.id,
              status: { not: "cancelado" },
              mpPaymentId: payment.id,
            }
          : {
              id: current.id,
              status: "pendiente",
              mpPaymentId: null,
            },
        data: {
          status: nextStatus,
          cancelledAt: now,
          couponReservedUntil: null,
          deliveryRetryAt: null,
          ...(reversed ? { couponUsedAt: null } : {}),
        },
      });
      if (claimed.count !== 1) {
        return tx.order.findUnique({ where: { id: current.id }, include: { items: true } });
      }

      for (const item of current.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
      if (reversed && current.couponId && current.couponUsedAt) {
        await tx.coupon.updateMany({
          where: { id: current.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      statusChanged = true;
    }

    return tx.order.findUnique({ where: { id: current.id }, include: { items: true } });
  });

  if (!updated) return null;
  const order = mapOrder(updated);
  if (statusChanged) {
    const event = eventForStatus(order.status);
    if (event) await notifyOrderEvent(event, order);
  }
  return order;
}

/**
 * Descarta un checkout que no llegó a crear la preferencia de Mercado Pago.
 * Restaura stock en la misma transacción para que el intento fallido no
 * figure como pedido ni deje mercadería reservada.
 */
export async function deletePendingOrder(idOrCode: string): Promise<boolean> {
  if (!hasDatabase) {
    const order = findMemOrder(idOrCode);
    if (!order || order.status !== "pendiente") return false;
    runtimeOrders.delete(order.internalId ?? idOrCode);
    return true;
  }

  ensureDb();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
        status: "pendiente",
      },
      include: { items: true },
    });
    if (!order) return false;

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
    await tx.order.delete({ where: { id: order.id } });
    return true;
  });
}

/** Busca un pedido en memoria por internalId o por código (#1234). */
function findMemOrder(idOrCode: string): Order | undefined {
  return (
    runtimeOrders.get(idOrCode) ??
    [...runtimeOrders.values()].find((o) => o.id === idOrCode)
  );
}

export async function updateOrderStatus(
  idOrCode: string,
  status: OrderStatus,
  options: { deliveryRetry?: boolean } = {}
): Promise<Order | null> {
  if (!hasDatabase) {
    const order = findMemOrder(idOrCode);
    if (!order) return null;
    const changed = order.status !== status;
    order.status = status;
    const now = new Date().toISOString();
    order.updatedAt = now;
    if (status === "entregado" && changed) order.deliveredAt = now;
    if (status === "en_preparacion" && changed) order.paidAt ??= now;
    if ((status === "cancelado" || status === "no_pagado") && changed) {
      order.cancelledAt = now;
      order.couponReservedUntil = undefined;
      order.deliveryRetryAt = status === "cancelado" && options.deliveryRetry ? now : undefined;
    }
    if (changed && !options.deliveryRetry) {
      const event = eventForStatus(status);
      if (event) await notifyOrderEvent(event, order);
    }
    return order;
  }
  ensureDb();
  const existing = await prisma.order.findFirst({
    where: { OR: [{ code: idOrCode }, { id: idOrCode }] },
    include: { items: true },
  });
  if (!existing) return null;
  if (existing.status === status) return mapOrder(existing);
  if (
    ((existing.status === "cancelado" || existing.status === "no_pagado") &&
      status !== existing.status) ||
    (existing.status === "entregado" && status !== "entregado")
  ) {
    return mapOrder(existing);
  }

  let statusChanged = false;
  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.order.updateMany({
      where: { id: existing.id, status: existing.status },
      data: {
        status,
        ...(status === "entregado" ? { deliveredAt: now } : {}),
        ...(status === "en_preparacion" ? { paidAt: existing.paidAt ?? now } : {}),
        ...(status === "cancelado" || status === "no_pagado"
          ? {
              cancelledAt: now,
              couponReservedUntil: null,
              deliveryRetryAt: status === "cancelado" && options.deliveryRetry ? now : null,
            }
          : {}),
      },
    });
    statusChanged = claimed.count === 1;

    // El cambio condicional hace que dos webhooks/clicks simultáneos no puedan
    // devolver dos veces las mismas unidades.
    if ((status === "cancelado" || status === "no_pagado") && statusChanged) {
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
      }
      if (existing.couponId && existing.couponUsedAt) {
        await tx.coupon.updateMany({
          where: { id: existing.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
        await tx.order.update({
          where: { id: existing.id },
          data: { couponUsedAt: null },
        });
      }
    }
    return tx.order.findUniqueOrThrow({
      where: { id: existing.id },
      include: { items: true },
    });
  });
  const order = mapOrder(updated);

  // Avisar a n8n solo cuando el estado realmente cambió (evita duplicados
  // cuando MP reintenta webhooks o el panel guarda sin cambios).
  if (statusChanged && !options.deliveryRetry) {
    const event = eventForStatus(status);
    if (event) await notifyOrderEvent(event, order);
  }

  return order;
}

/** Resultado de validar el código de entrega de un pedido. */
export type DeliveryResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not_found" | "no_code" | "invalid_code" | "already_delivered" };

/**
 * Confirma la entrega de un pedido validando el código que el cliente le dio
 * al repartidor. Si es correcto, el pedido pasa a "entregado" (dispara el
 * evento pedido_entregado).
 */
export async function confirmDelivery(idOrCode: string, code: string): Promise<DeliveryResult> {
  if (!hasDatabase) {
    const existing = findMemOrder(idOrCode);
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status === "entregado") return { ok: false, reason: "already_delivered" };
    if (!existing.deliveryCode) return { ok: false, reason: "no_code" };
    if (existing.deliveryCode !== code.trim()) return { ok: false, reason: "invalid_code" };
    const order = await updateOrderStatus(existing.internalId ?? existing.id, "entregado");
    if (!order) return { ok: false, reason: "not_found" };
    await closeRouteIfComplete(order);
    return { ok: true, order };
  }
  ensureDb();
  const existing = await prisma.order.findFirst({
    where: { OR: [{ code: idOrCode }, { id: idOrCode }] },
    include: { items: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "entregado") return { ok: false, reason: "already_delivered" };
  if (!existing.deliveryCode) return { ok: false, reason: "no_code" };
  if (existing.deliveryCode !== code.trim()) return { ok: false, reason: "invalid_code" };

  const order = await updateOrderStatus(existing.id, "entregado");
  if (!order) return { ok: false, reason: "not_found" };
  await closeRouteIfComplete(order);
  return { ok: true, order };
}

/**
 * Variante para el repartidor: confirma la entrega ingresando SÓLO el código
 * del cliente (sin saber qué pedido es). Busca entre los pedidos `en_camino`
 * el que tenga ese código y lo marca entregado. Así el repartidor puede
 * recorrer en el orden que quiera y cargar "el código de cualquiera".
 * Si hay más de uno con el mismo código (raro, son 4 dígitos), toma el de
 * menor `routeSeq`.
 */
export async function confirmDeliveryByCode(
  code: string,
  /** Si viene, solo matchea entregas asignadas a ese repartidor (blindaje). */
  repartidorId?: string
): Promise<DeliveryResult> {
  const trimmed = code.trim();
  if (!hasDatabase) {
    const all = [...runtimeOrders.values()];
    const match = all
      .filter(
        (o) =>
          o.status === "en_camino" &&
          o.deliveryCode === trimmed &&
          (!repartidorId || o.repartidorId === repartidorId)
      )
      .sort((a, b) => (a.routeSeq ?? 0) - (b.routeSeq ?? 0))[0];
    if (!match) {
      const already = all.some(
        (o) =>
          o.status === "entregado" &&
          o.deliveryCode === trimmed &&
          (!repartidorId || o.repartidorId === repartidorId)
      );
      return { ok: false, reason: already ? "already_delivered" : "invalid_code" };
    }
    const order = await updateOrderStatus(match.internalId ?? match.id, "entregado");
    if (!order) return { ok: false, reason: "not_found" };
    await closeRouteIfComplete(order);
    return { ok: true, order };
  }
  ensureDb();
  const match = await prisma.order.findFirst({
    where: {
      status: "en_camino",
      deliveryCode: trimmed,
      ...(repartidorId ? { repartidorId } : {}),
    },
    orderBy: { routeSeq: "asc" },
    include: { items: true },
  });
  if (!match) {
    const already = await prisma.order.findFirst({
      where: {
        status: "entregado",
        deliveryCode: trimmed,
        ...(repartidorId ? { repartidorId } : {}),
      },
      select: { id: true },
    });
    return { ok: false, reason: already ? "already_delivered" : "invalid_code" };
  }

  const order = await updateOrderStatus(match.id, "entregado");
  if (!order) return { ok: false, reason: "not_found" };
  await closeRouteIfComplete(order);
  return { ok: true, order };
}

export type CancelDeliveryResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      reason: "not_found" | "not_assigned" | "not_in_progress" | "already_delivered" | "already_cancelled";
    };

/** Cancela un envío todavía en camino, limitado al repartidor asignado. */
export async function cancelDelivery(
  idOrCode: string,
  repartidorId?: string
): Promise<CancelDeliveryResult> {
  const trimmed = idOrCode.trim();
  if (!trimmed) return { ok: false, reason: "not_found" };

  if (!hasDatabase) {
    const existing = findMemOrder(trimmed);
    if (!existing) return { ok: false, reason: "not_found" };
    if (repartidorId && existing.repartidorId !== repartidorId) {
      return { ok: false, reason: "not_assigned" };
    }
    if (existing.status === "entregado") return { ok: false, reason: "already_delivered" };
    if (existing.status === "cancelado") return { ok: false, reason: "already_cancelled" };
    if (existing.status !== "en_camino") return { ok: false, reason: "not_in_progress" };
    const order = await updateOrderStatus(existing.internalId ?? existing.id, "cancelado", {
      deliveryRetry: true,
    });
    if (!order) return { ok: false, reason: "not_found" };
    await notifyDeliveryReassignment(order);
    await closeRouteIfComplete(order);
    return { ok: true, order };
  }

  ensureDb();
  const existing = await prisma.order.findFirst({
    where: { OR: [{ code: trimmed }, { id: trimmed }] },
    include: { items: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  if (repartidorId && existing.repartidorId !== repartidorId) {
    return { ok: false, reason: "not_assigned" };
  }
  if (existing.status === "entregado") return { ok: false, reason: "already_delivered" };
  if (existing.status === "cancelado") return { ok: false, reason: "already_cancelled" };
  if (existing.status !== "en_camino") return { ok: false, reason: "not_in_progress" };

  const order = await updateOrderStatus(existing.id, "cancelado", { deliveryRetry: true });
  if (!order) return { ok: false, reason: "not_found" };
  await notifyDeliveryReassignment(order);
  await closeRouteIfComplete(order);
  return { ok: true, order };
}

/**
 * Pedidos del reparto en curso, ordenados por la ruta.
 * Una ruta sigue activa hasta que se cierre explícita o automáticamente; su
 * antigüedad nunca debe ocultar entregas que todavía estén pendientes.
 * Con `repartidorId` devuelve solo las entregas a cargo de ese repartidor:
 * cada repartidor ve únicamente su propia ruta.
 */
export async function listActiveRoute(repartidorId?: string): Promise<Order[]> {
  if (!hasDatabase) {
    return [...runtimeOrders.values()]
      .filter(
        (o) =>
          o.routeSeq != null &&
          (o.status === "en_camino" || o.status === "entregado") &&
          o.dispatchedAt != null &&
          o.routeClosedAt == null &&
          (!repartidorId || o.repartidorId === repartidorId)
      )
      .sort((a, b) => (a.routeSeq ?? 0) - (b.routeSeq ?? 0));
  }
  const rows = await prisma.order.findMany({
    where: {
      routeSeq: { not: null },
      dispatchedAt: { not: null },
      routeClosedAt: null,
      status: { in: ["en_camino", "entregado"] },
      ...(repartidorId ? { repartidorId } : {}),
    },
    orderBy: { routeSeq: "asc" },
    include: { items: true },
  });
  return rows.map(mapOrder);
}

export interface DispatchResult {
  /** Pedidos ya despachados, en el orden de la ruta. */
  route: Order[];
  /** URL de Google Maps con la ruta optimizada (vacía si no hubo envíos). */
  mapsUrl: string;
  count: number;
}

export class DeliveryDispatchConflictError extends Error {
  constructor() {
    super("Otro usuario ya incluyó uno de estos pedidos en un reparto.");
    this.name = "DeliveryDispatchConflictError";
  }
}

export interface RouteHistory {
  /** Identificador del lote; también agrupa rutas antiguas sin UUID. */
  batchId: string;
  dispatchedAt?: string;
  closedAt?: string;
  originSucursalId?: string;
  repartidorId?: string;
  orders: Order[];
}

/**
 * Historial de lotes ya cerrados, con cada pedido en el orden de su ruta.
 * Con `repartidorId` devuelve solo los lotes que salieron a cargo de ese
 * repartidor: es el historial que ve cada uno en su propia página de reparto.
 */
export async function listRouteHistory(
  limit = 30,
  repartidorId?: string
): Promise<RouteHistory[]> {
  const grouped = new Map<string, RouteHistory>();
  const add = (order: Order) => {
    if (order.routeSeq == null || !order.routeClosedAt) return;
    const batchId =
      order.routeBatchId ??
      `legacy:${order.repartidorId ?? "sin-asignar"}:${order.dispatchedAt ?? ""}`;
    const current = grouped.get(batchId) ?? {
      batchId,
      dispatchedAt: order.dispatchedAt,
      closedAt: order.routeClosedAt,
      originSucursalId: order.originSucursalId,
      repartidorId: order.repartidorId,
      orders: [],
    };
    current.orders.push(order);
    if ((order.routeClosedAt ?? "") > (current.closedAt ?? "")) {
      current.closedAt = order.routeClosedAt;
    }
    grouped.set(batchId, current);
  };

  if (!hasDatabase) {
    for (const order of runtimeOrders.values()) {
      if (repartidorId && order.repartidorId !== repartidorId) continue;
      add(order);
    }
  } else {
    const rows = await prisma.order.findMany({
      where: {
        routeSeq: { not: null },
        routeClosedAt: { not: null },
        ...(repartidorId ? { repartidorId } : {}),
      },
      orderBy: { routeClosedAt: "desc" },
      include: { items: true },
    });
    for (const row of rows) add(mapOrder(row));
  }

  return [...grouped.values()]
    .map((route) => ({
      ...route,
      orders: route.orders.sort((a, b) => (a.routeSeq ?? 0) - (b.routeSeq ?? 0)),
    }))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, limit);
}

/**
 * "Cerrar pedidos para enviar": toma los envíos pagados listos
 * (`en_preparacion` o una cancelación logística pagada, con punto en el mapa),
 * arma la ruta optimizada desde la
 * sucursal elegida y los despacha (pasan a `en_camino` con su `routeSeq`).
 * Si `orderIds` viene con ids (internos o códigos #), solo despacha esos:
 * el encargado elige qué pedidos entran en la ruta. `repartidorId` (Staff)
 * queda asignado a cada envío: es lo que blinda la vista del repartidor.
 * Avisa a n8n que cada pedido salió de la sucursal junto con su código de entrega.
 */
export async function dispatchDeliveries(
  sucursalId: string,
  orderIds?: string[],
  repartidorId?: string
): Promise<DispatchResult> {
  const sucursal = sucursales.find((s) => s.id === sucursalId);
  const origin = sucursal ? { lat: sucursal.lat, lng: sucursal.lng } : DEFAULT_ROUTE_ORIGIN;
  const idSet = orderIds && orderIds.length > 0 ? new Set(orderIds) : null;
  const routeBatchId = crypto.randomUUID();

  if (!hasDatabase) {
    const pending = [...runtimeOrders.values()].filter(
      (o) =>
        (o.status === "en_preparacion" ||
          (o.status === "cancelado" && Boolean(o.paidAt) && Boolean(o.deliveryRetryAt))) &&
        o.entrega === "envio" &&
        o.lat != null &&
        o.lng != null &&
        (!idSet || idSet.has(o.id) || (o.internalId != null && idSet.has(o.internalId)))
    );
    if (pending.length === 0) return { route: [], mapsUrl: "", count: 0 };

    const ordered = optimizeRoute(
      origin,
      pending.map((o) => ({ order: o, lat: o.lat as number, lng: o.lng as number }))
    );
    const nowIso = new Date().toISOString();
    ordered.forEach((stop, i) => {
      stop.order.status = "en_camino";
      stop.order.routeSeq = i + 1;
      stop.order.dispatchedAt = nowIso;
      stop.order.routeBatchId = routeBatchId;
      stop.order.routeClosedAt = undefined;
      stop.order.originSucursalId = sucursalId;
      stop.order.repartidorId = repartidorId;
      stop.order.deliveryRetryAt = undefined;
    });
    const routeOrders = ordered.map((s) => s.order);
    await Promise.all(routeOrders.map((o) => notifyOrderEvent("pedido_en_camino", o)));
    const mapsUrl = googleMapsRouteUrl(
      origin,
      ordered.map((s) => ({ lat: s.lat, lng: s.lng }))
    );
    return { route: routeOrders, mapsUrl, count: routeOrders.length };
  }

  ensureDb();
  const pending = await prisma.order.findMany({
    where: {
      OR: [
        { status: "en_preparacion" },
        { status: "cancelado", paidAt: { not: null }, deliveryRetryAt: { not: null } },
      ],
      entrega: "envio",
      lat: { not: null },
      lng: { not: null },
      ...(idSet ? { OR: [{ id: { in: [...idSet] } }, { code: { in: [...idSet] } }] } : {}),
    },
    include: { items: true },
  });
  if (pending.length === 0) return { route: [], mapsUrl: "", count: 0 };

  const stops = pending.map((o) => ({
    id: o.id,
    lat: o.lat as number,
    lng: o.lng as number,
  }));
  const ordered = optimizeRoute(origin, stops);
  const pendingById = new Map(pending.map((order) => [order.id, order]));

  const now = new Date();
  // El estado forma parte del WHERE: dos operadores no pueden despachar el
  // mismo pedido a lotes/repartidores distintos. Si uno se adelantó, se
  // revierte el lote completo y el segundo recibe un conflicto claro.
  await prisma.$transaction(async (tx) => {
    for (const [i, stop] of ordered.entries()) {
      const original = pendingById.get(stop.id)!;
      const isRetry = original.status === "cancelado";
      const claimed = await tx.order.updateMany({
        where: {
          id: stop.id,
          OR: [
            { status: "en_preparacion" },
            { status: "cancelado", paidAt: { not: null }, deliveryRetryAt: { not: null } },
          ],
        },
        data: {
          status: "en_camino",
          routeSeq: i + 1,
          dispatchedAt: now,
          routeBatchId,
          routeClosedAt: null,
          originSucursalId: sucursalId,
          repartidorId: repartidorId ?? null,
          deliveryRetryAt: null,
          ...(isRetry && original.couponId && !original.couponUsedAt
            ? { couponUsedAt: now }
            : {}),
        },
      });
      if (claimed.count !== 1) throw new DeliveryDispatchConflictError();

      // La cancelación devolvió las unidades y el uso del cupón. Al reasignar
      // un pedido ya cobrado se reservan otra vez, incluso si el stock queda
      // negativo: la venta pagada necesita resolución operativa.
      if (isRetry) {
        for (const item of original.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          });
        }
        if (original.couponId && !original.couponUsedAt) {
          await claimCouponUse(tx, original.couponId);
        }
      }
    }
  });

  // Releemos con items para armar los avisos y la respuesta, en orden de ruta.
  const rows = await prisma.order.findMany({
    where: { id: { in: ordered.map((s) => s.id) } },
    include: { items: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const routeOrders = ordered.map((s) => mapOrder(byId.get(s.id)!));

  // Los avisos son independientes: un lote grande espera como máximo el
  // timeout de un webhook, no cinco segundos multiplicados por cada pedido.
  await Promise.all(routeOrders.map((o) => notifyOrderEvent("pedido_en_camino", o)));

  const mapsUrl = googleMapsRouteUrl(
    origin,
    ordered.map((s) => ({ lat: s.lat, lng: s.lng }))
  );
  return { route: routeOrders, mapsUrl, count: routeOrders.length };
}

/** Cierra un lote para que deje de figurar entre los repartos activos. */
export async function closeDeliveryRoute(routeKey: string): Promise<number> {
  const closedAt = new Date();

  if (!hasDatabase) {
    const matches = [...runtimeOrders.values()].filter((order) => {
      const legacyKey = `legacy:${order.repartidorId ?? "sin-asignar"}:${order.dispatchedAt ?? ""}`;
      return order.routeBatchId === routeKey || (!order.routeBatchId && legacyKey === routeKey);
    });
    if (matches.some((order) => order.status === "en_camino")) return -1;
    let count = 0;
    for (const order of matches) {
      order.routeClosedAt = closedAt.toISOString();
      count += 1;
    }
    return count;
  }

  let where;
  if (routeKey.startsWith("legacy:")) {
    const match = /^legacy:(.*):(\d{4}-\d{2}-\d{2}T.*Z)$/.exec(routeKey);
    if (!match) return 0;
    const [, repartidorId, dispatchedAt] = match;
    where = {
      routeBatchId: null,
      repartidorId: repartidorId === "sin-asignar" ? null : repartidorId,
      dispatchedAt: new Date(dispatchedAt),
      routeClosedAt: null,
    };
  } else {
    where = { routeBatchId: routeKey, routeClosedAt: null };
  }

  return prisma.$transaction(async (tx) => {
    const pending = await tx.order.count({ where: { ...where, status: "en_camino" } });
    if (pending > 0) return -1;
    const result = await tx.order.updateMany({ where, data: { routeClosedAt: closedAt } });
    return result.count;
  });
}

/** Cierra automáticamente el lote cuando ya no quedan paradas en camino. */
async function closeRouteIfComplete(order: Order): Promise<void> {
  const routeKey =
    order.routeBatchId ??
    (order.dispatchedAt
      ? `legacy:${order.repartidorId ?? "sin-asignar"}:${order.dispatchedAt}`
      : null);
  if (routeKey) await closeDeliveryRoute(routeKey);
}

// ---------- Clientes ----------
export async function listCustomers(search?: string): Promise<Customer[]> {
  if (hasDatabase) {
    const rows = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      include: {
        orders: {
          where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
          select: { total: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapCustomer);
  }
  let list = [
    ...runtimeCustomers.values(),
    ...mockCustomers.filter((c) => !runtimeCustomers.has(c.id)),
  ];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(search)
    );
  }
  return list;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  if (hasDatabase) {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
          select: { total: true },
        },
      },
    });
    return c ? mapCustomer(c) : null;
  }
  return runtimeCustomers.get(id) ?? mockCustomers.find((c) => c.id === id) ?? null;
}

function normalizeDocument(value?: string): string {
  return String(value ?? "").trim().replace(/\D/g, "");
}

export async function findCustomer(by: {
  phone?: string;
  email?: string;
  document?: string;
}): Promise<Customer | null> {
  // Se busca por el teléfono normalizado, que es como quedó guardado.
  const phone = by.phone ? normalizePhone(by.phone) : undefined;
  const document = normalizeDocument(by.document);
  if (hasDatabase) {
    const clauses = [
      ...(phone ? [{ phone }] : []),
      ...(by.email ? [{ email: by.email }] : []),
      ...(by.document?.trim() ? [{ document: by.document.trim() }] : []),
    ];
    if (clauses.length === 0) return null;
    let c = await prisma.customer.findFirst({
      where: { OR: clauses },
      include: {
        orders: {
          where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
          select: { total: true },
        },
      },
    });
    if (!c && document) {
      const candidates = await prisma.customer.findMany({
        where: { document: { not: null } },
        include: {
          orders: {
            where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
            select: { total: true },
          },
        },
      });
      c = candidates.find((candidate) => normalizeDocument(candidate.document ?? "") === document) ?? null;
    }
    return c ? mapCustomer(c) : null;
  }
  return (
    [...runtimeCustomers.values(), ...mockCustomers].find(
      (c) =>
        (phone && normalizePhone(c.phone) === phone) ||
        (by.email && c.email === by.email) ||
        (document && normalizeDocument(c.document) === document)
    ) ?? null
  );
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  email?: string;
  document?: string;
}): Promise<Customer> {
  ensureDb();
  const phone = normalizePhone(input.phone);
  const c = await prisma.customer.upsert({
    where: { phone },
    update: {
      name: input.name,
      email: input.email ?? undefined,
      document: input.document ?? undefined,
    },
    create: {
      name: input.name,
      phone,
      email: input.email ?? null,
      document: input.document ?? null,
    },
    include: {
      orders: {
        where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
        select: { total: true },
      },
    },
  });
  return mapCustomer(c);
}

/** Actualiza los datos de contacto de un cliente existente (incluye documento). */
export async function updateCustomer(
  id: string,
  input: { name?: string; email?: string | null; document?: string | null }
): Promise<Customer | null> {
  ensureDb();
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return null;
  const c = await prisma.customer.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email === undefined ? undefined : input.email,
      document: input.document === undefined ? undefined : input.document,
    },
    include: {
      orders: {
        where: { status: { in: ["en_preparacion", "en_camino", "entregado"] } },
        select: { total: true },
      },
    },
  });
  return mapCustomer(c);
}

// ---------- Equipo (empleados) ----------
export async function listStaff(): Promise<Staff[]> {
  if (hasDatabase) {
    const rows = await prisma.staff.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(mapStaff);
  }
  return mockStaff.slice();
}

/** Integrante del equipo por id (para validar asignaciones y sesiones). */
export async function getStaff(id: string): Promise<Staff | null> {
  if (hasDatabase) {
    const row = await prisma.staff.findUnique({ where: { id } });
    return row ? mapStaff(row) : null;
  }
  return mockStaff.find((s) => s.id === id) ?? null;
}

export interface StaffInput {
  name: string;
  role: StaffRole;
  phone?: string | null;
  email?: string | null;
  username?: string | null;
  /** contraseña en texto plano; se hashea antes de guardar. */
  password?: string | null;
  permissions?: string[];
  active?: boolean;
}

/** Se lanza cuando el nombre de usuario ya está en uso por otro integrante. */
export class UsernameTakenError extends Error {
  constructor() {
    super("Ese nombre de usuario ya está en uso.");
    this.name = "UsernameTakenError";
  }
}

function isUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002");
}

export async function createStaff(input: StaffInput): Promise<Staff> {
  ensureDb();
  try {
    const s = await prisma.staff.create({
      data: {
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
        email: input.email ?? null,
        username: input.username ?? null,
        passwordHash: input.password ? hashPassword(input.password) : null,
        permissions: input.permissions ?? [],
        active: input.active ?? true,
      },
    });
    return mapStaff(s);
  } catch (e) {
    if (isUniqueViolation(e)) throw new UsernameTakenError();
    throw e;
  }
}

export async function updateStaff(
  id: string,
  input: Partial<StaffInput>
): Promise<Staff | null> {
  ensureDb();
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) return null;
  try {
    const s = await prisma.staff.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        phone: input.phone === undefined ? undefined : input.phone,
        email: input.email === undefined ? undefined : input.email,
        username: input.username === undefined ? undefined : input.username,
        // Solo se actualiza la contraseña si se envía una nueva no vacía.
        passwordHash: input.password ? hashPassword(input.password) : undefined,
        permissions: input.permissions === undefined ? undefined : input.permissions,
        active: input.active,
      },
    });
    return mapStaff(s);
  } catch (e) {
    if (isUniqueViolation(e)) throw new UsernameTakenError();
    throw e;
  }
}

/**
 * Login de un empleado por usuario + contraseña. Devuelve el `Staff` (sin el
 * hash) si las credenciales son válidas y el integrante está activo, o `null`.
 * Sin base de datos no hay empleados con login (los mocks no tienen contraseña).
 */
export async function verifyStaffLogin(
  username: string,
  password: string
): Promise<Staff | null> {
  if (!hasDatabase) return null;
  const row = await prisma.staff.findUnique({ where: { username } });
  if (!row || !row.active || !row.passwordHash) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  return mapStaff(row);
}

export async function deleteStaff(id: string): Promise<boolean> {
  ensureDb();
  try {
    await prisma.staff.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------- Estadísticas (reportes) ----------
export interface NewCustomersStats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  last30Days: number;
  /** Altas por mes, de más viejo a más nuevo (últimos 6 meses). */
  byMonth: { month: string; label: string; count: number }[];
}

/** Estadísticas de altas de clientes nuevos, calculadas sobre `joinedAt`. */
export async function getNewCustomersStats(): Promise<NewCustomersStats> {
  const customers = await listCustomers();
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = monthKey(lastMonthDate);
  const cutoff30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  // Esqueleto de los últimos 6 meses (incluido el actual).
  const months: { month: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: monthKey(d),
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      count: 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.month, m]));

  let thisMonth = 0;
  let lastMonth = 0;
  let last30Days = 0;
  for (const c of customers) {
    const d = new Date(c.joined);
    const key = monthKey(d);
    if (key === thisKey) thisMonth++;
    if (key === lastKey) lastMonth++;
    if (d.getTime() >= cutoff30) last30Days++;
    const bucket = byKey.get(key);
    if (bucket) bucket.count++;
  }

  return { total: customers.length, thisMonth, lastMonth, last30Days, byMonth: months };
}

/** Top de clientes por monto gastado. */
export async function getTopBuyers(limit = 10): Promise<Customer[]> {
  const customers = await listCustomers();
  return customers
    .slice()
    .sort((a, b) => b.spent - a.spent || b.orders - a.orders)
    .slice(0, limit);
}

// ---------- Login por teléfono (OTP WhatsApp) ----------

/** Almacén en memoria de OTP para cuando no hay base de datos (solo dev). */
type MemOtp = { codeHash: string; expiresAt: number; attempts: number; createdAt: number };
const memOtp = new Map<string, MemOtp>();

/**
 * Guarda (reemplaza) el código OTP de un teléfono.
 * Aplica un anti-spam: rechaza un envío nuevo si el anterior es muy reciente.
 */
export async function storeOtp(phone: string, codeHash: string, expiresAt: Date): Promise<void> {
  const now = Date.now();
  if (hasDatabase) {
    const existing = await prisma.otpCode.findUnique({ where: { phone } });
    if (existing && now - existing.createdAt.getTime() < OTP_RESEND_MS) {
      throw new Error("Acabamos de enviarte un código. Esperá unos segundos antes de pedir otro.");
    }
    await prisma.otpCode.upsert({
      where: { phone },
      update: { codeHash, expiresAt, attempts: 0, createdAt: new Date(now) },
      create: { phone, codeHash, expiresAt },
    });
    return;
  }
  const existing = memOtp.get(phone);
  if (existing && now - existing.createdAt < OTP_RESEND_MS) {
    throw new Error("Acabamos de enviarte un código. Esperá unos segundos antes de pedir otro.");
  }
  memOtp.set(phone, { codeHash, expiresAt: expiresAt.getTime(), attempts: 0, createdAt: now });
}

export type OtpResult = "ok" | "expired" | "invalid" | "locked" | "none";

/** Verifica el código de un teléfono y, si es válido, lo consume. */
export async function verifyOtp(phone: string, codeHash: string): Promise<OtpResult> {
  const now = Date.now();

  if (hasDatabase) {
    const row = await prisma.otpCode.findUnique({ where: { phone } });
    if (!row) return "none";
    if (row.expiresAt.getTime() < now) {
      await prisma.otpCode.delete({ where: { phone } });
      return "expired";
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otpCode.delete({ where: { phone } });
      return "locked";
    }
    if (row.codeHash === codeHash) {
      await prisma.otpCode.delete({ where: { phone } });
      return "ok";
    }
    await prisma.otpCode.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    return "invalid";
  }

  const row = memOtp.get(phone);
  if (!row) return "none";
  if (row.expiresAt < now) {
    memOtp.delete(phone);
    return "expired";
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    memOtp.delete(phone);
    return "locked";
  }
  if (row.codeHash === codeHash) {
    memOtp.delete(phone);
    return "ok";
  }
  row.attempts += 1;
  return "invalid";
}

export interface SessionSubject {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

/**
 * Crea o recupera el cliente tras un OTP válido y devuelve el sujeto de sesión.
 * El rol se decide por `ADMIN_PHONES`: si el teléfono está en la lista, queda
 * como admin (y se persiste en la base si la hay).
 */
export async function loginByPhone(input: {
  phone: string;
  name?: string;
  document?: string;
  email?: string;
}): Promise<SessionSubject> {
  const role: Role = isAdminPhone(input.phone) ? "admin" : "cliente";

  if (hasDatabase) {
    const c = await prisma.customer.upsert({
      where: { phone: input.phone },
      update: {
        // No pisar los datos del cliente en los ingresos posteriores.
        ...(role === "admin" ? { role } : {}),
      },
      create: {
        phone: input.phone,
        name: input.name?.trim() || "Cliente",
        document: input.document?.trim() || null,
        email: input.email?.trim() || null,
        role,
      },
    });
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      // Un admin sigue siendo admin aunque salga de ADMIN_PHONES.
      role: c.role === "admin" || role === "admin" ? "admin" : "cliente",
    };
  }

  // Sin base de datos (dev): sujeto sintético basado en el teléfono.
  const phone = normalizePhone(input.phone);
  const mock = mockCustomers.find((c) => normalizePhone(c.phone) === phone);
  const id = mock?.id ?? runtimeCustomerId(phone);
  const existing = runtimeCustomers.get(id) ?? mock;
  const isNew = !existing;
  const name = isNew ? input.name?.trim() || "Cliente" : existing.name;
  const customer: Customer = existing
    ? { ...existing, phone }
    : {
        id,
        name,
        email: input.email?.trim() || "",
        phone,
        document: input.document?.trim(),
        orders: 0,
        spent: 0,
        joined: new Date().toISOString(),
      };
  runtimeCustomers.set(id, customer);

  return {
    id: customer.id,
    name: customer.name,
    phone,
    role,
  };
}
