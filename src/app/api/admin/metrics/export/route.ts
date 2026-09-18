import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth/session";
import { sessionHasPerm } from "@/lib/auth/permissions";
import { hasDatabase, prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID_STATUSES = ["en_preparacion", "en_camino", "entregado"] as const;

function styleSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8102E" } };
    cell.alignment = { vertical: "middle" };
  });
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
      });
    }
  });
}

function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function weekdayIndex(date: Date): number {
  const short = date.toLocaleDateString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
  });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export async function GET() {
  const session = await getSession();
  if (!session || !sessionHasPerm(session, "analitica")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!hasDatabase) {
    return NextResponse.json({ error: "La exportación requiere la base de datos de producción." }, { status: 503 });
  }

  const [orders, customers, products, events, branches] = await Promise.all([
    prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } }),
    prisma.customer.findMany({ orderBy: { joinedAt: "desc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.analyticsEvent.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.sucursal.findMany({ orderBy: [{ region: "asc" }, { name: "asc" }] }),
  ]);

  const paidOrders = orders.filter(
    (order) =>
      PAID_STATUSES.includes(order.status as (typeof PAID_STATUSES)[number]) ||
      (order.status === "cancelado" && Boolean(order.paidAt || order.mpPaymentId))
  );
  const sales = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const shipping = paidOrders.reduce((sum, order) => sum + order.shippingFee, 0);
  const discounts = paidOrders.reduce((sum, order) => sum + order.discount, 0);
  const units = paidOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0),
    0
  );
  const visits = events.filter((event) => event.type === "visit").length;
  const cartAdds = events.filter((event) => event.type === "cart_add").length;

  const daily = new Map<string, { orders: number; sales: number; shipping: number; discounts: number; units: number; visits: number; cartAdds: number }>();
  const ensureDay = (key: string) => {
    const current = daily.get(key) ?? { orders: 0, sales: 0, shipping: 0, discounts: 0, units: 0, visits: 0, cartAdds: 0 };
    daily.set(key, current);
    return current;
  };
  for (const order of paidOrders) {
    const bucket = ensureDay(dayKey(order.createdAt));
    bucket.orders++;
    bucket.sales += order.total;
    bucket.shipping += order.shippingFee;
    bucket.discounts += order.discount;
    bucket.units += order.items.reduce((sum, item) => sum + item.qty, 0);
  }
  for (const event of events) {
    const bucket = ensureDay(dayKey(event.createdAt));
    if (event.type === "visit") bucket.visits++;
    else if (event.type === "cart_add") bucket.cartAdds++;
  }
  const busiestDay = [...daily.entries()].sort((a, b) => b[1].orders - a[1].orders)[0];
  const weekdayMetrics = WEEKDAYS.map((name) => ({ name, orders: 0, sales: 0, shipping: 0, units: 0 }));
  for (const order of paidOrders) {
    const bucket = weekdayMetrics[weekdayIndex(order.createdAt)];
    if (!bucket) continue;
    bucket.orders++;
    bucket.sales += order.total;
    bucket.shipping += order.shippingFee;
    bucket.units += order.items.reduce((sum, item) => sum + item.qty, 0);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avícola Don Ramón";
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const summary = workbook.addWorksheet("Resumen");
  summary.addRow(["Métrica", "Valor"]);
  summary.addRows([
    ["Fecha de exportación", new Date()],
    ["Ventas cobradas", sales],
    ["Pedidos cobrados", paidOrders.length],
    ["Ticket promedio", paidOrders.length ? sales / paidOrders.length : 0],
    ["Unidades vendidas", units],
    ["Gasto cobrado en envíos", shipping],
    ["Descuentos otorgados", discounts],
    ["Pedidos con envío", paidOrders.filter((order) => order.entrega === "envio").length],
    ["Pedidos con retiro", paidOrders.filter((order) => order.entrega === "retiro").length],
    ["Clientes registrados", customers.length],
    ["Visitas registradas", visits],
    ["Agregados al carrito", cartAdds],
    ["Conversión visita a pedido", visits ? paidOrders.length / visits : 0],
    ["Día con más pedidos", busiestDay?.[0] ?? "Sin datos"],
    ["Pedidos del día pico", busiestDay?.[1].orders ?? 0],
  ]);
  styleSheet(summary, [34, 24]);
  summary.getColumn(2).numFmt = "#,##0.00";
  for (const row of [3, 5, 7, 8]) summary.getCell(row, 2).numFmt = '"$"#,##0';
  summary.getCell(14, 2).numFmt = "0.0%";
  summary.getCell(2, 2).numFmt = "yyyy-mm-dd hh:mm";

  const dailySheet = workbook.addWorksheet("Métricas diarias");
  dailySheet.addRow(["Fecha", "Pedidos", "Ventas", "Envíos cobrados", "Descuentos", "Unidades", "Visitas", "Agregados al carrito"]);
  for (const [date, values] of [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    dailySheet.addRow([date, values.orders, values.sales, values.shipping, values.discounts, values.units, values.visits, values.cartAdds]);
  }
  styleSheet(dailySheet, [14, 12, 16, 18, 16, 12, 12, 22]);
  [3, 4, 5].forEach((column) => (dailySheet.getColumn(column).numFmt = '"$"#,##0'));

  const weekdaySheet = workbook.addWorksheet("Días de semana");
  weekdaySheet.addRow(["Día", "Pedidos", "Ventas", "Envíos cobrados", "Unidades", "Ticket promedio"]);
  weekdayMetrics.forEach((day) => {
    weekdaySheet.addRow([day.name, day.orders, day.sales, day.shipping, day.units, day.orders ? day.sales / day.orders : 0]);
  });
  styleSheet(weekdaySheet, [18, 12, 18, 20, 12, 18]);
  [3, 4, 6].forEach((column) => (weekdaySheet.getColumn(column).numFmt = '"$"#,##0'));

  const ordersSheet = workbook.addWorksheet("Pedidos");
  ordersSheet.addRow(["ID", "Código", "Fecha", "Estado", "Cliente", "Teléfono", "Modalidad", "Sucursal", "Dirección", "Pago", "Total cobrado", "Descuento", "Envío", "Distancia km", "Franja", "Fecha entrega", "Cupón", "Pagado", "Despachado", "Entregado", "Cancelado", "Notas"]);
  for (const order of orders) {
    ordersSheet.addRow([order.id, order.code, order.createdAt, order.status, order.customerName, order.phone, order.entrega, order.originSucursalId, order.address, order.payment, order.total, order.discount, order.shippingFee, order.shippingDistanceKm, order.deliverySlot, order.deliveryDate, order.couponCode, order.paidAt, order.dispatchedAt, order.deliveredAt, order.cancelledAt, order.notes]);
  }
  styleSheet(ordersSheet, [28, 12, 20, 18, 24, 18, 14, 20, 34, 18, 16, 14, 14, 14, 14, 16, 14, 20, 20, 20, 20, 42]);
  [11, 12, 13].forEach((column) => (ordersSheet.getColumn(column).numFmt = '"$"#,##0'));
  [3, 16, 18, 19, 20, 21].forEach((column) => (ordersSheet.getColumn(column).numFmt = "yyyy-mm-dd hh:mm"));

  const itemsSheet = workbook.addWorksheet("Detalle productos");
  itemsSheet.addRow(["Pedido", "Fecha", "Producto ID", "Producto", "Cantidad", "Precio unitario", "Total línea"]);
  for (const order of orders) {
    for (const item of order.items) itemsSheet.addRow([order.code ?? order.id, order.createdAt, item.productId, item.name, item.qty, item.price, item.qty * item.price]);
  }
  styleSheet(itemsSheet, [16, 20, 24, 34, 12, 18, 18]);
  [6, 7].forEach((column) => (itemsSheet.getColumn(column).numFmt = '"$"#,##0'));
  itemsSheet.getColumn(2).numFmt = "yyyy-mm-dd hh:mm";

  const customersSheet = workbook.addWorksheet("Clientes");
  customersSheet.addRow(["ID", "Nombre", "Teléfono", "Email", "Documento", "Alta", "Pedidos cobrados", "Total gastado"]);
  customers.forEach((customer) => {
    const customerOrders = paidOrders.filter((order) => order.customerId === customer.id);
    customersSheet.addRow([customer.id, customer.name, customer.phone, customer.email, customer.document, customer.joinedAt, customerOrders.length, customerOrders.reduce((sum, order) => sum + order.total, 0)]);
  });
  styleSheet(customersSheet, [28, 26, 18, 30, 18, 20, 18, 18]);
  customersSheet.getColumn(6).numFmt = "yyyy-mm-dd hh:mm";
  customersSheet.getColumn(8).numFmt = '"$"#,##0';

  const productsSheet = workbook.addWorksheet("Productos");
  productsSheet.addRow(["ID", "Nombre", "Categoría", "Precio", "Precio anterior", "Stock", "Disponible", "Oferta diaria", "Creado", "Actualizado"]);
  products.forEach((product) => productsSheet.addRow([product.id, product.name, product.category, product.price, product.oldPrice, product.stock, product.available ? "Sí" : "No", product.dailyOffer ? "Sí" : "No", product.createdAt, product.updatedAt]));
  styleSheet(productsSheet, [24, 36, 16, 16, 18, 12, 14, 14, 20, 20]);
  [4, 5].forEach((column) => (productsSheet.getColumn(column).numFmt = '"$"#,##0'));
  [9, 10].forEach((column) => (productsSheet.getColumn(column).numFmt = "yyyy-mm-dd hh:mm"));

  const trafficSheet = workbook.addWorksheet("Eventos web");
  trafficSheet.addRow(["ID", "Fecha", "Tipo", "Producto ID", "Ruta"]);
  events.forEach((event) => trafficSheet.addRow([event.id, event.createdAt, event.type, event.productId, event.path]));
  styleSheet(trafficSheet, [28, 20, 16, 24, 40]);
  trafficSheet.getColumn(2).numFmt = "yyyy-mm-dd hh:mm";

  const branchesSheet = workbook.addWorksheet("Sucursales");
  branchesSheet.addRow(["ID", "Nombre", "Calle", "Altura", "Región", "Latitud", "Longitud", "Google Maps", "Activa"]);
  branches.forEach((branch) => branchesSheet.addRow([branch.id, branch.name, branch.street, branch.number, branch.region, branch.lat, branch.lng, branch.mapsUrl, branch.active ? "Sí" : "No"]));
  styleSheet(branchesSheet, [24, 30, 30, 12, 24, 16, 16, 46, 12]);

  const branchMetricsSheet = workbook.addWorksheet("Métricas sucursales");
  branchMetricsSheet.addRow(["Sucursal", "Región", "Pedidos asociados", "Retiros", "Envíos", "Ventas", "Envíos cobrados"]);
  branches.forEach((branch) => {
    const branchOrders = paidOrders.filter((order) => order.originSucursalId === branch.id);
    branchMetricsSheet.addRow([
      branch.name,
      branch.region,
      branchOrders.length,
      branchOrders.filter((order) => order.entrega === "retiro").length,
      branchOrders.filter((order) => order.entrega === "envio").length,
      branchOrders.reduce((sum, order) => sum + order.total, 0),
      branchOrders.reduce((sum, order) => sum + order.shippingFee, 0),
    ]);
  });
  styleSheet(branchMetricsSheet, [30, 24, 20, 12, 12, 18, 20]);
  [6, 7].forEach((column) => (branchMetricsSheet.getColumn(column).numFmt = '"$"#,##0'));

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `metricas-polleria-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
