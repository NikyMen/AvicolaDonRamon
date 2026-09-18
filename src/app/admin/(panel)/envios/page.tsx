import { requirePerm } from "@/lib/auth/permissions";
import { getDeliverySettings, listOrders, listSucursales } from "@/lib/repo";
import { EnviosSettingsForm } from "./EnviosSettingsForm";
import { OrdersManager } from "../pedidos/OrdersManager";

export const dynamic = "force-dynamic";

export default async function EnviosPage() {
  await requirePerm("envios");
  const [settings, orders, sucursales] = await Promise.all([
    getDeliverySettings(),
    listOrders({ statusNot: "pendiente" }),
    listSucursales(),
  ]);
  const origin =
    sucursales.find((s) => s.id === settings.fixedSucursalId) ??
    sucursales.find((s) => s.id === "don-ramon") ??
    sucursales[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Envios</h1>
        <p className="text-sm text-brand-ink/55">
          Configuracion del costo que se cobra al cliente en el checkout.
        </p>
      </div>

      <EnviosSettingsForm settings={settings} originName={origin?.name ?? "Sucursal fija"} />

      <section className="space-y-4 border-t border-black/10 pt-6">
        <OrdersManager orders={orders} />
      </section>
    </div>
  );
}
