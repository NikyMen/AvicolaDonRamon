import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login?next=/admin");

  const perms = session.perms ?? [];
  const isSuperAdmin = perms.includes("*");

  return (
    <AdminChrome perms={perms} name={session.name} isSuperAdmin={isSuperAdmin}>
      {children}
    </AdminChrome>
  );
}
