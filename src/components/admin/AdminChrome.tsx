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
  Store,
  Bell,
  ChevronDown,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ConsultoriaDigitalLogo } from "@/components/ConsultoriaDigitalLogo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { cn } from "@/lib/cn";
import { WhatsAppIcon } from "@/components/admin/WhatsAppIcon";
import { hasPermission } from "@/lib/auth/perm-modules";

// `perm` = clave del módulo (PERM_MODULES). Sin `perm` el ítem es visible
// para cualquier sesión de panel (ej. Dashboard).
const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, hideKey: "dashboard" },
  { href: "/admin/entregas", label: "Entregas", icon: Truck, perm: "entregas", hideKey: "entregas" },
  { href: "/admin/envios", label: "Envios", icon: Route, perm: "envios", hideKey: "envios" },
  { href: "/admin/sucursales", label: "Sucursales", icon: Store, perm: "sucursales", hideKey: "sucursales" },
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

function NavContent({
  perms,
  hiddenModules,
  onNavigate,
}: {
  perms: string[];
  hiddenModules: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items = nav.filter(
    (item) => (!item.perm || hasPermission(perms, item.perm)) && (!item.hideKey || !hiddenModules.includes(item.hideKey))
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
  hiddenModules,
  name,
  isSuperAdmin,
  notifications,
  children,
}: {
  perms: string[];
  hiddenModules: string[];
  name: string;
  isSuperAdmin: boolean;
  notifications: {
    id: string;
    href: string;
    title: string;
    description: string;
  }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen && !profileOpen) return;

    function closeMenus(event: MouseEvent) {
      if (!menusRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen, profileOpen]);

  return (
    <div className="flex min-h-screen bg-[#f1f0ee]">
      {/* Sidebar de escritorio (estática) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand-ink text-white md:flex">
        <NavContent perms={perms} hiddenModules={hiddenModules} />
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
          <NavContent perms={perms} hiddenModules={hiddenModules} onNavigate={() => setOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-[60] flex items-center justify-between gap-4 border-b border-black/5 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center">
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              className="shrink-0 rounded-lg p-2 text-brand-ink/60 hover:bg-black/5 md:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
          <div ref={menusRef} className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                aria-label="Abrir notificaciones"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                  setNotificationsRead(true);
                }}
                className="relative rounded-lg p-2 text-brand-ink/60 transition hover:bg-black/5 hover:text-brand-ink"
              >
                <Bell size={20} />
                {!notificationsRead && notifications.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-white">
                    {notifications.length}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
                  <div className="border-b border-black/5 px-4 py-3">
                    <p className="font-semibold text-brand-ink">Notificaciones</p>
                    <p className="text-xs text-brand-ink/50">Avisos que requieren tu atención</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={notification.href}
                          onClick={() => setNotificationsOpen(false)}
                          className="block rounded-lg px-3 py-2.5 transition hover:bg-brand-cream"
                        >
                          <p className="text-sm font-semibold text-brand-ink">{notification.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-brand-ink/55">
                            {notification.description}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <p className="px-3 py-6 text-center text-sm text-brand-ink/50">
                        No hay avisos pendientes.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Abrir menú de administrador"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left transition hover:bg-black/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm leading-tight sm:block">
                  <span className="block font-semibold text-brand-ink">{name}</span>
                  <span className="block text-xs text-brand-ink/50">
                    {isSuperAdmin ? "Administrador" : "Empleado"} · Entre Ríos
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "hidden text-brand-ink/45 transition-transform sm:block",
                    profileOpen && "rotate-180"
                  )}
                />
              </button>

              {profileOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-56 overflow-hidden rounded-xl border border-black/10 bg-white p-2 shadow-xl">
                  <div className="border-b border-black/5 px-3 py-2 sm:hidden">
                    <p className="truncate text-sm font-semibold text-brand-ink">{name}</p>
                    <p className="text-xs text-brand-ink/50">
                      {isSuperAdmin ? "Administrador" : "Empleado"} · Entre Ríos
                    </p>
                  </div>
                  <Link
                    href="/admin/config"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-cream hover:text-brand-ink"
                  >
                    <Settings size={18} /> Configuración
                  </Link>
                  <LogoutButton redirectTo="/admin/login" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-red transition hover:bg-brand-red/5 disabled:opacity-50" />
                </div>
              ) : null}
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
