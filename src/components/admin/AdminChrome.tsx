"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Route,
  Package,
  Users,
  UserCog,
  Tag,
  TicketPercent,
  Sparkles,
  LineChart,
  Bell,
  Search,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { cn } from "@/lib/cn";
import { hasPermission } from "@/lib/auth/perm-modules";

// `perm` = clave del módulo (PERM_MODULES). Sin `perm` el ítem es visible
// para cualquier sesión de panel (ej. Dashboard).
const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/entregas", label: "Entregas", icon: Truck, perm: "entregas" },
  { href: "/admin/envios", label: "Envios", icon: Route, perm: "envios" },
  { href: "/admin/productos", label: "Productos", icon: Package, perm: "productos" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, perm: "clientes" },
  { href: "/admin/equipo", label: "Equipo", icon: UserCog, perm: "equipo" },
  { href: "/admin/ofertas", label: "Ofertas", icon: Tag, perm: "ofertas" },
  { href: "/admin/cupones", label: "Cupones y promos", icon: TicketPercent, perm: "cupones" },
  { href: "/admin/reportes", label: "IA y reportes", icon: Sparkles, perm: "reportes" },
  { href: "/admin/analitica", label: "Analítica", icon: LineChart, perm: "analitica" },
  { href: "/admin/config", label: "Configuración", icon: Settings },
  { href: "/admin/asistente", label: "Apagar asistente de IA", icon: Sparkles },
];

const HIDDEN_MODULES_KEY = "admin:hidden-modules";

function NavContent({ perms, onNavigate }: { perms: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);

  useEffect(() => {
    const syncHiddenModules = () => {
      try {
        const value = JSON.parse(localStorage.getItem(HIDDEN_MODULES_KEY) ?? "[]");
        if (Array.isArray(value)) setHiddenModules(value);
      } catch {}
    };
    try {
      syncHiddenModules();
    } catch {
      // Se mantienen los valores por defecto si el navegador bloquea localStorage.
    }
    window.addEventListener("storage", syncHiddenModules);
    return () => window.removeEventListener("storage", syncHiddenModules);
  }, []);

  const items = nav.filter(
    (item) => (!item.perm || hasPermission(perms, item.perm)) && !hiddenModules.includes(item.perm ?? "")
  );

  return (
    <>
      <div className="border-b border-white/10 px-5 py-4">
        <Logo dark />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-red text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <LogoutButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white" />
      </div>
    </>
  );
}

export function AdminChrome({
  perms,
  name,
  isSuperAdmin,
  children,
}: {
  perms: string[];
  name: string;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f1f0ee]">
      {/* Sidebar de escritorio (estática) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand-ink text-white md:flex">
        <NavContent perms={perms} />
      </aside>

      {/* Drawer móvil + backdrop */}
      <div className={cn("fixed inset-0 z-[70] md:hidden", open ? "" : "pointer-events-none")}>
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col bg-brand-ink text-white shadow-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"
          >
            <X size={20} />
          </button>
          <NavContent perms={perms} onNavigate={() => setOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-[60] flex items-center justify-between gap-4 border-b border-black/5 bg-white px-4 py-3 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              className="shrink-0 rounded-lg p-2 text-brand-ink/60 hover:bg-black/5 md:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-ink/50 md:w-80 md:flex-none">
              <Search size={16} className="shrink-0" />
              <input
                placeholder="Buscar pedidos, productos, clientes…"
                className="w-full bg-transparent outline-none placeholder:text-brand-ink/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-brand-ink/60 hover:bg-black/5">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-red" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-sm leading-tight sm:block">
                <p className="font-semibold text-brand-ink">{name}</p>
                <p className="text-xs text-brand-ink/50">
                  {isSuperAdmin ? "Administrador" : "Empleado"} · Entre Ríos
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
