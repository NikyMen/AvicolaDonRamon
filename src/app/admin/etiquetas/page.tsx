import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { requirePerm } from "@/lib/auth/permissions";
import { listOrdersByIds } from "@/lib/repo";
import { formatARS } from "@/lib/format";
import { googleMapsPointUrl } from "@/lib/route";
import { deliveryEstimateLabel } from "@/lib/entrega";
import { sucursales } from "@/lib/sucursales";
import type { Order } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Etiquetas de envío · Avícola Don Ramón",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const PAGO: Record<Order["payment"], string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
};

/**
 * Vista de impresión de etiquetas de envío: una etiqueta A6 (105×148 mm) por
 * pedido, 4 por hoja A4, para imprimir y pegar en el paquete. Con el diálogo
 * del navegador también se puede "Guardar como PDF".
 * Se abre desde /admin/entregas con ?ids=<id1,id2,…> (ids internos o códigos).
 */
export default async function EtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; autoPrint?: string }>;
}) {
  await requirePerm("entregas");

  const { ids, autoPrint } = await searchParams;
  const wanted = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const orders = wanted.length > 0 ? await listOrdersByIds(wanted) : [];

  // QR con el punto exacto de entrega: el repartidor lo escanea desde el
  // paquete y le abre la navegación a esa casa.
  const qrs = new Map<string, string>();
  for (const o of orders) {
    if (o.lat != null && o.lng != null) {
      const url = googleMapsPointUrl({ lat: o.lat, lng: o.lng });
      qrs.set(o.internalId ?? o.id, await QRCode.toDataURL(url, { margin: 1, width: 220 }));
    }
  }

  const sucursalName = (id?: string) => sucursales.find((s) => s.id === id)?.name;

  // El checkout agrega notas automáticas ("Pedido web · …", "Mapa: https://…")
  // que en la etiqueta no aportan (el QR ya lleva al mapa). Dejamos solo lo
  // que haya escrito el cliente.
  const notaCliente = (notes?: string) =>
    notes
      ?.split("\n")
      .filter((l) => l.trim() && !/^(pedido web|mapa:)/i.test(l.trim()))
      .join(" · ") || null;

  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white">
      {/* Estilos de impresión: A4 sin márgenes, 4 etiquetas A6 por hoja. */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .sheet { margin: 0 !important; box-shadow: none !important; }
        }
        .sheet {
          width: 210mm;
          display: grid;
          grid-template-columns: 105mm 105mm;
          grid-auto-rows: 148.5mm;
          background: white;
        }
        .label {
          width: 105mm;
          height: 148.5mm;
          padding: 6mm;
          display: flex;
          flex-direction: column;
          border: 0.3mm dashed #bbb;
          break-inside: avoid;
          overflow: hidden;
          color: #1a1a1a;
        }
      `}</style>

      {/* Barra superior (no se imprime) */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-brand-ink">Etiquetas de envío</h1>
          <p className="text-xs text-brand-ink/60">
            {orders.length} {orders.length === 1 ? "etiqueta" : "etiquetas"} · A6, 4 por hoja A4.
            Cortá por la línea de puntos y pegala en el paquete.
          </p>
        </div>
        <Link
          href="/admin/entregas"
          className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-black/5"
        >
          Volver a Entregas
        </Link>
        <PrintButton autoPrint={autoPrint === "1"} />
      </div>

      {orders.length === 0 ? (
        <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-brand-ink/60">
          No encontramos pedidos para estas etiquetas. Volvé a{" "}
          <Link href="/admin/entregas" className="font-semibold text-brand-red hover:underline">
            Entregas
          </Link>{" "}
          y abrí las etiquetas desde ahí.
        </p>
      ) : (
        <div className="sheet mx-auto my-4 shadow-lg">
          {orders.map((o) => {
            const key = o.internalId ?? o.id;
            const qr = qrs.get(key);
            const origen = sucursalName(o.originSucursalId);
            return (
              <div key={key} className="label">
                {/* Encabezado */}
                <div className="flex items-start justify-between gap-2 border-b-2 border-neutral-800 pb-2">
                  <div>
                    <p className="text-[3.2mm] font-extrabold uppercase tracking-wide">
                      Avícola Don Ramón
                    </p>
                    <p className="text-[2.6mm] text-neutral-500">
                      {origen ? `Sale de ${origen}` : "Envío a domicilio"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[4.2mm] font-extrabold">{o.id}</p>
                    {o.routeSeq != null && (
                      <p className="text-[2.8mm] font-bold text-neutral-600">
                        Parada {o.routeSeq}
                      </p>
                    )}
                    {o.routeBatchId && (
                      <p className="text-[2.4mm] font-semibold text-neutral-500">
                        Lote {o.routeBatchId.slice(0, 8).toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Destinatario */}
                <div className="mt-2">
                  <p className="text-[2.4mm] font-bold uppercase tracking-wider text-neutral-400">
                    Destinatario
                  </p>
                  <p className="text-[4.6mm] font-extrabold leading-tight">{o.customer}</p>
                  {o.phone && <p className="text-[3.2mm] font-semibold">Tel: {o.phone}</p>}
                  {deliveryEstimateLabel(o.deliverySlot, o.deliveryDate) && (
                    <p className="text-[3.2mm] font-semibold">
                      Entrega: {deliveryEstimateLabel(o.deliverySlot, o.deliveryDate)}
                    </p>
                  )}
                </div>

                {/* Dirección + QR */}
                <div className="mt-2 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[2.4mm] font-bold uppercase tracking-wider text-neutral-400">
                      Dirección
                    </p>
                    <p className="text-[3.6mm] font-bold leading-snug">
                      {o.address ?? "Sin dirección"}
                    </p>
                    {notaCliente(o.notes) && (
                      <p className="mt-1 text-[2.8mm] leading-snug text-neutral-600">
                        Nota: {notaCliente(o.notes)}
                      </p>
                    )}
                  </div>
                  {qr && (
                    <div className="flex-none text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt={`Mapa de ${o.id}`} className="h-[26mm] w-[26mm]" />
                      <p className="text-[2.2mm] text-neutral-500">Escaneá para ir</p>
                    </div>
                  )}
                </div>

                {/* Pedido */}
                <div className="mt-2 min-h-0 flex-1 overflow-hidden">
                  <p className="text-[2.4mm] font-bold uppercase tracking-wider text-neutral-400">
                    Pedido
                  </p>
                  <table className="w-full text-[3mm] leading-snug">
                    <tbody>
                      {o.items.map((i) => (
                        <tr key={i.name} className="border-b border-dotted border-neutral-300">
                          <td className="w-[9mm] py-[0.8mm] font-extrabold">{i.qty}×</td>
                          <td className="py-[0.8mm]">{i.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pie: total + pago */}
                <div className="mt-2 flex items-end justify-between border-t-2 border-neutral-800 pt-2">
                  <div>
                    <p className="text-[2.6mm] font-semibold text-neutral-600">
                      Pago: {PAGO[o.payment]}
                    </p>
                    <p className="text-[2.4mm] text-neutral-400">
                      El repartidor valida la entrega con el código del cliente.
                    </p>
                  </div>
                  <p className="text-[4.6mm] font-extrabold">{formatARS(o.total)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
