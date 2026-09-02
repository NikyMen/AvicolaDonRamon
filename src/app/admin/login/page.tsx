import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ConsultoriaDigitalLogo } from "@/components/ConsultoriaDigitalLogo";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin/productos");
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f0ee] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-soft">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-red text-xl font-bold text-white">
            P
          </div>
          <h1 className="text-xl font-bold text-brand-ink">Panel de administración</h1>
          <p className="text-sm text-brand-ink/55">Avícola Don Ramón</p>
        </div>
        <AdminLoginForm next={next ?? "/admin/productos"} />
        <ConsultoriaDigitalLogo className="mt-7 justify-center border-t border-black/5 pt-5" />
      </div>
    </div>
  );
}
