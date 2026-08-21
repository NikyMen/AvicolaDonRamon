import Link from "next/link";
import { MapPin, MessageCircle, ShoppingBag, ChevronRight, Phone, User, LogIn } from "lucide-react";
import { getCustomer } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { WHATSAPP_SOPORTE_TEXTO, WHATSAPP_SOPORTE_URL } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const menu = [
  {
    label: "Hacer un pedido",
    description: "Mirá el catálogo y las promos del día",
    icon: ShoppingBag,
    href: "/productos",
  },
  {
    label: "Sucursales",
    description: "Dónde estamos y horarios de atención",
    icon: MapPin,
    href: "/sucursales",
  },
];

export default async function CuentaPage() {
  const session = await getSession();

  // Solo cargamos datos personales si hay una sesión real.
  const customer = session ? await getCustomer(session.sub) : null;
  const since = customer ? new Date(customer.joined).getFullYear() : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pt-4 md:pt-8">
      {/* Cabecera de usuario */}
      <div className="card-pop flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-red to-brand-dark text-2xl font-bold text-white">
          {session ? session.name.charAt(0).toUpperCase() : <User size={28} />}
        </div>
        <div className="min-w-0">
          {session ? (
            <>
              <h1 className="truncate text-lg font-extrabold text-brand-ink">{session.name}</h1>
              <p className="flex items-center gap-1 text-sm text-brand-ink/55">
                <Phone size={13} /> {session.phone}
              </p>
              {since && <p className="text-xs text-brand-ink/45">Cliente desde {since}</p>}
            </>
          ) : (
            <>
              <h1 className="text-lg font-extrabold text-brand-ink">Invitado</h1>
              <p className="text-sm text-brand-ink/55">No iniciaste sesión</p>
              <p className="text-xs text-brand-ink/45">Ingresá para ver tus datos</p>
            </>
          )}
        </div>
      </div>

      {/* Soporte por WhatsApp (solo consultas o problemas) */}
      <a
        href={WHATSAPP_SOPORTE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="card-pop flex items-center justify-between gap-3 rounded-2xl bg-[#25D366] p-5 text-white shadow-card transition active:scale-[0.99]"
        style={{ animationDelay: "0.08s" }}
      >
        <div className="min-w-0">
          <p className="text-base font-extrabold leading-tight">{WHATSAPP_SOPORTE_TEXTO}</p>
          <p className="mt-1 text-xs text-white/80">
            Escribinos por WhatsApp si tuviste un inconveniente con tu pedido.
          </p>
        </div>
        <MessageCircle className="shrink-0" />
      </a>

      {/* Accesos */}
      <div
        className="card-pop overflow-hidden rounded-2xl bg-white shadow-soft"
        style={{ animationDelay: "0.16s" }}
      >
        {menu.map(({ label, description, icon: Icon, href }, i) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-3 px-4 py-4 hover:bg-brand-cream ${
              i !== 0 ? "border-t border-black/5" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red/10">
              <Icon size={19} className="text-brand-red" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-ink">{label}</span>
              <span className="block truncate text-xs text-brand-ink/50">{description}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-brand-ink/30" />
          </Link>
        ))}
      </div>

      {session?.role === "admin" && (
        <Link
          href="/admin"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-ink py-3 text-sm font-semibold text-white hover:bg-brand-ink/90"
        >
          Ir al panel de administración
        </Link>
      )}

      {session ? (
        <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 py-3 text-sm font-semibold text-brand-ink/70 hover:bg-black/5" />
      ) : (
        <Link
          href="/ingresar?next=/cuenta"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          <LogIn size={18} /> Iniciar sesión
        </Link>
      )}
    </div>
  );
}
