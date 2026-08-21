import { distanceKm, CORRIENTES_CENTER } from "./geo";

/**
 * Optimización de la ruta de reparto.
 *
 * Cuando el encargado "cierra pedidos para enviar", se arma una ruta que
 * arranca en la sucursal de salida y recorre todos los domicilios tratando de
 * minimizar el total recorrido. Usamos la heurística del vecino más cercano
 * (nearest-neighbor): es rápida, sin dependencias, y suficientemente buena para
 * la cantidad de envíos de un reparto. La distancia se calcula con `distanceKm`
 * (haversine) que ya usamos para validar la zona de reparto.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Ordena `stops` empezando desde `origin` con vecino más cercano.
 * No muta el arreglo original y devuelve los stops en el orden de visita.
 */
export function optimizeRoute<T extends GeoPoint>(origin: GeoPoint, stops: T[]): T[] {
  const pending = stops.slice();
  const ordered: T[] = [];
  let current: GeoPoint = origin;

  while (pending.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pending.length; i++) {
      const d = distanceKm(current, pending[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    const [next] = pending.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/**
 * URL de Google Maps con indicaciones (turn-by-turn) que arranca en la
 * sucursal, pasa por cada domicilio en el orden de la ruta y termina en el
 * último. El repartidor la abre desde el panel o desde su página móvil.
 */
export function googleMapsRouteUrl(origin: GeoPoint, orderedStops: GeoPoint[]): string {
  const coord = (p: GeoPoint) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  params.set("origin", coord(origin));

  if (orderedStops.length === 0) {
    // Sin paradas: sólo mostramos el origen.
    params.set("destination", coord(origin));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const destination = orderedStops[orderedStops.length - 1];
  const waypoints = orderedStops.slice(0, -1);
  params.set("destination", coord(destination));
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(coord).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Punto de un solo domicilio para abrir el mapa directo a esa entrega. */
export function googleMapsPointUrl(p: GeoPoint): string {
  return `https://www.google.com/maps?q=${p.lat},${p.lng}`;
}

/** Origen por defecto de la ruta si una sucursal no tuviera coordenadas. */
export const DEFAULT_ROUTE_ORIGIN: GeoPoint = CORRIENTES_CENTER;
