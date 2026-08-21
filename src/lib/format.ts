/** Formatea un número como precio en pesos argentinos. */
export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formatea una cantidad entera con separador de miles. */
export function formatCantidad(value: number): string {
  return new Intl.NumberFormat("es-AR").format(value);
}

/** Fecha corta es-AR: 31/05 */
export function formatShortDate(iso: string): string {
  const parts = argentinaDateParts(iso);
  return `${parts.day}/${parts.month}`;
}

/** Fecha + hora: 31/05 14:30 */
export function formatDateTime(iso: string): string {
  const parts = argentinaDateParts(iso);
  return `${parts.day}/${parts.month}, ${parts.hour}:${parts.minute}`;
}

function argentinaDateParts(iso: string) {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  return { day, month, hour, minute };
}
