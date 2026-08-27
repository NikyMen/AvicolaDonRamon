/**
 * Geografía del reparto de Avícola Don Ramón en Paraná. La validación
 * corre en el cliente y nuevamente en el servidor.
 */

/** Centro aproximado de Paraná. */
export const PARANA_CENTER = { lat: -31.7413, lng: -60.5115 };

/** No se informó un monto mínimo de compra. */
export const MIN_ENVIO_TOTAL = 0;

/** Importe único de envío para todas las zonas habilitadas. */
export const FLAT_DELIVERY_FEE = 2_000;

/** Caja amplia del ejido urbano de Paraná, usada también por Nominatim. */
export const PARANA_BOUNDS = {
  latMin: -31.9,
  latMax: -31.65,
  lngMin: -60.65,
  lngMax: -60.4,
};

/** Radio máximo (km) desde el centro; refuerza la caja en las esquinas. */
const MAX_KM = 18;

/** Distancia haversine en km entre dos puntos. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** ¿El punto está dentro de la zona de reparto (ciudad de Paraná)? */
export function isInsideParana(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < PARANA_BOUNDS.latMin || lat > PARANA_BOUNDS.latMax) return false;
  if (lng < PARANA_BOUNDS.lngMin || lng > PARANA_BOUNDS.lngMax) return false;
  return distanceKm({ lat, lng }, PARANA_CENTER) <= MAX_KM;
}
