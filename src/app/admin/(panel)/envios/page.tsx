import { requirePerm } from "@/lib/auth/permissions";
import { listOrders } from "@/lib/repo";
import { formatARS } from "@/lib/format";
import { FLAT_DELIVERY_FEE } from "@/lib/geo";
import { sucursales } from "@/lib/sucursales";
import { OrdersManager } from "../pedidos/OrdersManager";

export const dynamic = "force-dynamic";

export default async function EnviosPage() {
  await requirePerm("envios");
  const orders = await listOrders({ statusNot: "pendiente" });
  const origin = sucursales.find((s) => s.id === "don-ramon") ?? sucursales[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Envios</h1>
        <p className="text-sm text-brand-ink/55">
          Costo fijo que se cobra al cliente en el checkout.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-semibold text-brand-ink">Envío a todas las zonas</h2>
        <p className="mt-1 text-2xl font-black text-brand-red">
          {formatARS(FLAT_DELIVERY_FEE)}
        </p>
        <p className="mt-2 text-sm text-brand-ink/55">
          Salida desde {origin?.name ?? "Avícola Don Ramón"}. El importe es único y no depende de la distancia.
        </p>
      </section>

      <section className="space-y-4 border-t border-black/10 pt-6">
        <OrdersManager orders={orders} />
      </section>
    </div>
  );
}
