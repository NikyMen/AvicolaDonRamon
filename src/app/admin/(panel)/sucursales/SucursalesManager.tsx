"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, MapPin, Plus, Save, Store } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Sucursal } from "@/lib/sucursales";
import { saveSucursalAction, type SaveSucursalState } from "./actions";

const EMPTY_STATE: SaveSucursalState = {};
const DEFAULT_POINT = { lat: -27.4692, lng: -58.8306 };

function coordinatesFromGoogleMaps(url: string): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(url);
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function LocationEditor({ initial }: { initial?: Sucursal }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [point, setPoint] = useState({
    lat: initial?.lat ?? DEFAULT_POINT.lat,
    lng: initial?.lng ?? DEFAULT_POINT.lng,
  });
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? "");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [point.lat, point.lng],
        zoom: initial ? 16 : 13,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="#C8102E" stroke="#fff" stroke-width="1.2"><path d="M20 10c0 6-8 13-8 13S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#F6B40A" stroke="none"/></svg>`,
        iconSize: [34, 34],
        iconAnchor: [17, 32],
      });
      const setMarker = (lat: number, lng: number) => {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const next = markerRef.current!.getLatLng();
            setPoint({ lat: next.lat, lng: next.lng });
          });
        } else markerRef.current.setLatLng([lat, lng]);
      };
      setMarker(point.lat, point.lng);
      map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
        setMarker(event.latlng.lat, event.latlng.lng);
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 150);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Se inicializa una vez por formulario expandido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function importLocation() {
    const imported = coordinatesFromGoogleMaps(mapsUrl.trim());
    if (!imported) {
      setImportError("No encontramos coordenadas. Pegá el enlace completo de Google Maps que contiene la ubicación.");
      return;
    }
    setImportError("");
    setPoint(imported);
    markerRef.current?.setLatLng([imported.lat, imported.lng]);
    mapRef.current?.flyTo([imported.lat, imported.lng], 16, { animate: true, duration: 0.8 });
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-brand-ink/60">Enlace de Google Maps</span>
        <div className="flex gap-2">
          <input
            name="mapsUrl"
            type="url"
            value={mapsUrl}
            onChange={(event) => setMapsUrl(event.target.value)}
            placeholder="https://www.google.com/maps/..."
            className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-red"
          />
          <button type="button" onClick={importLocation} className="btn-gold shrink-0 px-3 py-2 text-xs">
            Importar
          </button>
        </div>
      </label>
      {importError && <p className="text-xs font-semibold text-brand-red">{importError}</p>}
      <div ref={containerRef} className="h-52 overflow-hidden rounded-xl border border-black/10" />
      <p className="text-[11px] text-brand-ink/50">Pegá un enlace completo o tocá/arrastrá el pin directamente en el mapa.</p>
      <input type="hidden" name="lat" value={point.lat} />
      <input type="hidden" name="lng" value={point.lng} />
    </div>
  );
}

function BranchForm({ branch }: { branch?: Sucursal }) {
  const [state, formAction, pending] = useActionState(saveSucursalAction, EMPTY_STATE);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/60">ID</span>
          <input name="id" required readOnly={Boolean(branch)} defaultValue={branch?.id} placeholder="ej: centro-san-luis" className="input-admin w-full read-only:opacity-60" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/60">Nombre</span>
          <input name="name" required defaultValue={branch?.name} placeholder="Nombre comercial" className="input-admin w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/60">Calle</span>
          <input name="street" required defaultValue={branch?.street} className="input-admin w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/60">Altura</span>
          <input name="number" required defaultValue={branch?.number} className="input-admin w-full" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-brand-ink/60">Región</span>
          <input name="region" required defaultValue={branch?.region} placeholder="Ej: Corrientes Capital" className="input-admin w-full" />
        </label>
      </div>
      <LocationEditor initial={branch} />
      <label className="flex items-center gap-2 rounded-lg bg-brand-cream px-3 py-2 text-sm font-semibold text-brand-ink">
        <input type="checkbox" name="active" defaultChecked={branch?.active ?? true} className="h-4 w-4 accent-brand-red" />
        Disponible para retiro
      </label>
      {state.error && <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Sucursal guardada correctamente.</p>}
      <button disabled={pending} className="btn-primary w-full disabled:opacity-50">
        <Save size={16} /> {pending ? "Guardando…" : "Guardar sucursal"}
      </button>
    </form>
  );
}

function BranchCard({ branch }: { branch: Sucursal }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl bg-white shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${branch.active ? "bg-brand-red/10 text-brand-red" : "bg-black/5 text-brand-ink/35"}`}>
          <Store size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-brand-ink">{branch.name}</span>
          <span className="block truncate text-sm text-brand-ink/50">{branch.street} {branch.number}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${branch.active ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-brand-ink/45"}`}>
          {branch.active ? "Activa" : "Pausada"}
        </span>
        <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} size={18} />
      </button>
      {open && (
        <div className="border-t border-black/5 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-cream px-3 py-2 text-xs">
            <span><strong>ID:</strong> {branch.id}</span>
            {branch.mapsUrl && (
              <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-red hover:underline">
                Ver en Google Maps <ExternalLink size={13} />
              </a>
            )}
          </div>
          <BranchForm branch={branch} />
        </div>
      )}
    </article>
  );
}

export function SucursalesManager({ branches }: { branches: Sucursal[] }) {
  const regions = useMemo(() => {
    const grouped = new Map<string, Sucursal[]>();
    for (const branch of branches) {
      const list = grouped.get(branch.region) ?? [];
      list.push(branch);
      grouped.set(branch.region, list);
    }
    return [...grouped.entries()];
  }, [branches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Sucursales</h1>
          <p className="text-sm text-brand-ink/55">Administrá las ubicaciones que aparecen como opción de retiro.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand-ink shadow-soft">
          {branches.filter((branch) => branch.active).length} activas
        </span>
      </div>

      <details className="group rounded-2xl border border-dashed border-brand-red/30 bg-white shadow-soft">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 font-bold text-brand-red">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red text-white"><Plus size={18} /></span>
          Agregar una sucursal
          <ChevronDown className="ml-auto transition group-open:rotate-180" size={18} />
        </summary>
        <div className="border-t border-black/5 p-4"><BranchForm /></div>
      </details>

      {regions.map(([region, items]) => (
        <section key={region} className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={17} className="text-brand-red" />
            <h2 className="font-bold text-brand-ink">{region}</h2>
            <span className="text-xs font-semibold text-brand-ink/40">{items.length} sucursales</span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((branch) => <BranchCard key={branch.id} branch={branch} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
