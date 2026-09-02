import { redirect } from "next/navigation";
import { AdminLoginForm } from "./admin/login/AdminLoginForm";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** La portada es el acceso al sistema. Una sesión activa entra a Stock. */
export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin/productos");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1f0ee] p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-soft">
        <div className="mb-7 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-2xl font-bold text-brand-ink">Acceso al sistema</h1>
          <p className="mt-1 text-sm text-brand-ink/55">Gestioná productos, precios y stock</p>
        </div>
        <AdminLoginForm next="/admin/productos" />
        <p className="mt-6 text-center text-xs text-brand-ink/45">Panel privado de administración</p>
      </section>
    </main>
  );
}
