import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/perm-modules";
import { countPendingDeliveries, countLowStockProducts, getAdminUiSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login?next=/admin/productos");

  const perms = session.perms ?? [];
  const isSuperAdmin = perms.includes("*");
  const [pendingDeliveries, lowStockProducts, uiSettings] = await Promise.all([
    hasPermission(perms, "entregas")
      ? countPendingDeliveries()
      : Promise.resolve(0),
    hasPermission(perms, "productos") ? countLowStockProducts() : Promise.resolve(0),
    getAdminUiSettings(),
  ]);
  const notifications = [
    ...(pendingDeliveries > 0
      ? [
          {
            id: "pending-deliveries",
            href: "/admin/entregas",
            title: `${pendingDeliveries} ${pendingDeliveries === 1 ? "entrega pendiente" : "entregas pendientes"}`,
            description: "Hay pedidos listos para organizar y enviar.",
          },
        ]
      : []),
    ...(lowStockProducts > 0
      ? [
          {
            id: "low-stock",
            href: "/admin/productos",
            title: `${lowStockProducts} ${lowStockProducts === 1 ? "producto con poco stock" : "productos con poco stock"}`,
            description: "Quedan 5 unidades o menos. Revisá el inventario.",
          },
        ]
      : []),
  ];

  return (
    <AdminChrome
      perms={perms}
      hiddenModules={uiSettings.hiddenModules}
      name={session.name}
      isSuperAdmin={isSuperAdmin}
      notifications={notifications}
    >
      {children}
    </AdminChrome>
  );
}
