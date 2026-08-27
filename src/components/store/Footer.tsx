import Link from "next/link";
import { MapPin, Phone, Clock, Instagram, Facebook } from "lucide-react";
import { Logo } from "@/components/Logo";
import { WHATSAPP_VISIBLE } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="mt-8 hidden border-t border-black/5 bg-brand-ink text-white/80 md:block">
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-8 px-6 py-10">
        <div className="col-span-1">
          <Logo dark />
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Productos frescos en Paraná todos los días. Hacé tu pedido desde la web y
            recibilo a domicilio.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" aria-label="Instagram" className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
              <Instagram size={18} />
            </a>
            <a href="#" aria-label="Facebook" className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
              <Facebook size={18} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Navegación</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-white">Inicio</Link></li>
            <li><Link href="/productos" className="hover:text-white">Productos</Link></li>
            <li><Link href="/ofertas" className="hover:text-white">Ofertas</Link></li>
            <li><Link href="/sucursales" className="hover:text-white">Sucursales</Link></li>
            <li><Link href="/cuenta" className="hover:text-white">Mi cuenta</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Dónde estamos</h4>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><MapPin size={15} /> Av. Las Américas 4117, Paraná</li>
            <li className="mt-2 flex items-center gap-2">
              <Phone size={15} /> Consultas: WhatsApp {WHATSAPP_VISIBLE}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Horarios</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Clock size={15} /> Lun a Vie: 8:00–13:00 y 16:30–20:30</li>
            <li className="flex items-center gap-2"><Clock size={15} /> Sábado: 8:00–13:00</li>
            <li className="flex items-center gap-2"><Clock size={15} /> Domingo: 9:30–13:00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Avícola Don Ramón
      </div>
    </footer>
  );
}
