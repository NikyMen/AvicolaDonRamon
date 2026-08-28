/**
 * Catálogo de permisos del panel admin (datos puros, sin `server-only`).
 *
 * Cada empleado (`Staff`) puede tener asignado un subconjunto de estas claves.
 * El super-admin (login por `ADMIN_USER`/`ADMIN_PASSWORD`) lleva `["*"]`, que
 * habilita todos los módulos.
 *
 * Este archivo NO importa nada del servidor para poder usarse también en
 * componentes cliente (sidebar, formulario de equipo).
 */

/** Comodín de permisos: habilita todos los módulos. */
export const ALL_PERMS = "*";

export interface PermModule {
  /** clave guardada en `Staff.permissions` y chequeada en cada módulo */
  key: string;
  /** etiqueta visible al asignar permisos */
  label: string;
  /** ruta del módulo en el panel */
  href: string;
}

/** Módulos del panel que pueden asignarse a un empleado. */
export const PERM_MODULES: PermModule[] = [
  { key: "entregas", label: "Entregas", href: "/admin/entregas" },
  { key: "envios", label: "Envios", href: "/admin/envios" },
  { key: "productos", label: "Stock", href: "/admin/productos" },
  { key: "clientes", label: "Clientes", href: "/admin/clientes" },
  { key: "equipo", label: "Equipo", href: "/admin/equipo" },
  { key: "ofertas", label: "Ofertas", href: "/admin/ofertas" },
  { key: "cupones", label: "Cupones y promos", href: "/admin/cupones" },
  { key: "reportes", label: "IA y reportes", href: "/admin/reportes" },
  { key: "analitica", label: "Analítica", href: "/admin/analitica" },
  { key: "conocimiento", label: "Base de conocimiento", href: "/admin/conocimiento" },
  { key: "asistente", label: "Asistente WhatsApp", href: "/admin/asistente" },
];

export const PERM_KEYS: string[] = PERM_MODULES.map((m) => m.key);

/** ¿La lista de permisos `perms` habilita el módulo `key`? */
export function hasPermission(perms: string[] | undefined | null, key: string): boolean {
  if (!perms) return false;
  return perms.includes(ALL_PERMS) || perms.includes(key);
}
