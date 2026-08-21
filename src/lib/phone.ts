/**
 * Normalización de teléfonos a una clave canónica única.
 *
 * El teléfono es la identidad del cliente (Customer.phone es @unique), así que
 * el mismo número tipeado de cualquier forma tiene que caer siempre en la misma
 * fila. Sin esto, "+54 379 452-5617", "0379 15 452 5617" y "3794525617" crean
 * tres clientes distintos y las compras quedan repartidas entre ellos.
 *
 * Canónico para Argentina = código de área + número local, sin 54, sin el 9 de
 * celular, sin el 0 de larga distancia y sin el 15. Ej: 3794525617.
 * Los números que no encajan en el patrón argentino se guardan solo con sus
 * dígitos (sin separadores), que ya es mejor que el texto crudo.
 *
 * Este módulo es puro a propósito (sin "server-only") para poder usarse también
 * en el cliente al validar formularios.
 */

/** Largos posibles del código de área en Argentina (11, 379, 2983…). */
const AREA_LENGTHS = [2, 3, 4];
/** Largo de un número argentino sin prefijos: área + local. */
const AR_NATIONAL_LENGTH = 10;

export function normalizePhone(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";

  // Prefijo internacional marcado como 00.
  if (d.startsWith("00")) d = d.slice(2);

  // País: 54. Solo lo sacamos si lo que queda sigue teniendo largo de número
  // argentino, para no mutilar un número extranjero que arranque en 54.
  if (d.startsWith("54") && d.length >= 12) d = d.slice(2);

  // 9 de celular (54 9 379…).
  if (d.length === AR_NATIONAL_LENGTH + 1 && d.startsWith("9")) d = d.slice(1);
  // 0 de larga distancia (0379…). Ningún número argentino empieza con 0, así
  // que se saca siempre: puede venir con el 15 todavía puesto (0379 15 …).
  if (d.startsWith("0")) d = d.slice(1);

  // 15 de celular, que va después del código de área (0379 15 4525617).
  if (d.length === AR_NATIONAL_LENGTH + 2) {
    for (const area of AREA_LENGTHS) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }

  return d;
}

/** Valida que el teléfono normalizado tenga una longitud razonable. */
export function isValidPhone(phone: string): boolean {
  const d = normalizePhone(phone);
  return d.length >= 8 && d.length <= 15;
}

/** Formato para mostrar en el panel: 3794525617 -> 379 452-5617. */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length !== AR_NATIONAL_LENGTH) return raw;
  return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
}
