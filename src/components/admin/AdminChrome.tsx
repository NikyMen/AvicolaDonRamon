"use client";

import { useEffect, useRef, useState } from "react";
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
  BrainCircuit,
  LineChart,
  Menu,
  X,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ConsultoriaDigitalLogo } from "@/components/ConsultoriaDigitalLogo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { cn } from "@/lib/cn";
import { WhatsAppIcon } from "@/components/admin/WhatsAppIcon";
import { hasPermission } from "@/lib/auth/perm-modules";
import {
  ADMIN_PREFERENCES_EVENT,
  DEFAULT_HIDDEN_MODULES,
  HIDDEN_MODULES_KEY,
  readHiddenModules,
} from "@/lib/admin-preferences";

// `perm` = clave del módulo (PERM_MODULES). Sin `perm` el ítem es visible
// para cualquier sesión de panel (ej. Dashboard).
const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, hideKey: "dashboard" },
  { href: "/admin/entregas", label: "Entregas", icon: Truck, perm: "entregas", hideKey: "entregas" },
  { href: "/admin/envios", label: "Envios", icon: Route, perm: "envios", hideKey: "envios" },
  { href: "/admin/productos", label: "Stock", icon: Package, perm: "productos", hideKey: "productos" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, perm: "clientes", hideKey: "clientes" },
  { href: "/admin/equipo", label: "Equipo", icon: UserCog, perm: "equipo", hideKey: "equipo" },
  { href: "/admin/ofertas", label: "Ofertas", icon: Tag, perm: "ofertas", hideKey: "ofertas" },
  { href: "/admin/cupones", label: "Cupones y promos", icon: TicketPercent, perm: "cupones", hideKey: "cupones" },
  { href: "/admin/reportes", label: "IA y reportes", icon: Sparkles, perm: "reportes", hideKey: "reportes" },
  { href: "/admin/analitica", label: "Analítica", icon: LineChart, perm: "analitica", hideKey: "analitica" },
  { href: "/admin/conocimiento", label: "Base de conocimiento", icon: BrainCircuit, perm: "conocimiento", hideKey: "conocimiento" },
  { href: "/admin/asistente", label: "Asistente WhatsApp", icon: WhatsAppIcon, perm: "asistente", hideKey: "asistente" },
];

function NavContent({ perms, onNavigate }: { perms: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [hiddenModules, setHiddenModules] = useState<string[]>([...DEFAULT_HIDDEN_MODULES]);

  useEffect(() => {
    const syncHiddenModules = () => {
      try {
        setHiddenModules(readHiddenModules());
      } catch {}
    };
    try {
      syncHiddenModules();
    } catch {
      // Se mantienen los valores por defecto si el navegador bloquea localStorage.
    }
    window.addEventListener("storage", syncHiddenModules);
    window.addEventListener(ADMIN_PREFERENCES_EVENT, syncHiddenModules);
    return () => {
      window.removeEventListener("storage", syncHiddenModules);
      window.removeEventListener(ADMIN_PREFERENCES_EVENT, syncHiddenModules);
    };
  }, []);

  const items = nav.filter(
    (item) => (!item.perm || hasPermission(perms, item.perm)) && !hiddenModules.includes(item.hideKey)
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
        <Link
          href="/admin/config"
          onClick={onNavigate}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
            pathname.startsWith("/admin/config")
              ? "bg-brand-red text-white"
              : "text-white/65 hover:bg-white/10 hover:text-white"
          )}
        >
          <Settings size={18} />
          Configuración
        </Link>
        <LogoutButton
          redirectTo="/admin/login"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white"
        />
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const toggleAccount = () => {
    setAccountOpen((current) => !current);
  };

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
        <header className="sticky top-0 z-[60] flex items-center justify-end gap-2 border-b border-black/5 bg-white px-4 py-3 md:gap-3 md:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="mr-auto shrink-0 rounded-lg p-2 text-brand-ink/60 hover:bg-black/5 md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div ref={accountRef} className="relative">
              <button
                onClick={toggleAccount}
                aria-label="Abrir menú de usuario"
                aria-expanded={accountOpen}
                aria-controls="admin-account-menu"
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-black/5 sm:px-2"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left text-sm leading-tight sm:block">
                  <p className="font-semibold text-brand-ink">{name}</p>
                  <p className="text-xs text-brand-ink/50">
                    {isSuperAdmin ? "Administrador" : "Empleado"} · Entre Ríos
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-brand-ink/45 transition-transform",
                    accountOpen && "rotate-180"
                  )}
                />
              </button>

              {accountOpen && (
                <div
                  id="admin-account-menu"
                  className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xl"
                >
                  <div className="border-b border-black/5 px-3 py-2 sm:hidden">
                    <p className="text-sm font-semibold text-brand-ink">{name}</p>
                    <p className="text-xs text-brand-ink/50">
                      {isSuperAdmin ? "Administrador" : "Empleado"} · Entre Ríos
                    </p>
                  </div>
                  <Link
                    href="/admin/config"
                    onClick={() => setAccountOpen(false)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-cream hover:text-brand-ink"
                  >
                    <Settings size={18} /> Configuración
                  </Link>
                  <LogoutButton
                    redirectTo="/admin/login"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-red transition hover:bg-brand-red/5"
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
        <footer className="px-4 pb-5 pt-1 md:px-6">
          <ConsultoriaDigitalLogo />
        </footer>
      </div>
    </div>
  );
}
