"use client";

import Link from "next/link";
import { X, Home, UtensilsCrossed, Tag, User, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useUI } from "@/store/ui";
import { WHATSAPP_VISIBLE } from "@/lib/whatsapp";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/productos", label: "Productos", icon: UtensilsCrossed },
  { href: "/ofertas", label: "Ofertas", icon: Tag },
  { href: "/sucursales", label: "Sucursales", icon: MapPin },
  { href: "/cuenta", label: "Mi cuenta", icon: User },
];

export function SideMenu() {
  const open = useUI((s) => s.menuOpen);
  const close = useUI((s) => s.closeMenu);

  return (
    <>
      <div
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <Logo />
          <button onClick={close} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-black/5">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 px-2 py-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-brand-ink hover:bg-brand-cream"
            >
              <Icon size={20} className="text-brand-red" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-black/5 px-4 py-4 text-sm text-brand-ink/70">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-brand-red" /> Junin 2198, Corrientes
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-brand-red" /> Sarmiento y La Pampa
          </p>
          <p className="flex items-center gap-2">
            <Phone size={16} className="text-brand-red" /> Consultas: WhatsApp {WHATSAPP_VISIBLE}
          </p>
        </div>
      </aside>
    </>
  );
}
