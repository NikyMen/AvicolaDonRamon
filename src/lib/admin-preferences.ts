/** Preferencias visuales locales del panel. No son datos de negocio. */
export const HIDDEN_MODULES_KEY = "admin:hidden-modules";
export const ADVANCED_REPORTS_KEY = "admin:advanced-report-data";
export const ADMIN_PREFERENCES_EVENT = "admin-preferences-change";
const MODULE_DEFAULTS_VERSION_KEY = "admin:hidden-modules-version";
const MODULE_DEFAULTS_VERSION = "dashboard-analytics-v1";

export const DEFAULT_HIDDEN_MODULES = [
  "dashboard",
  "analitica",
  "entregas",
  "envios",
  "ofertas",
  "clientes",
  "cupones",
] as const;

/** Aplica una sola vez los nuevos módulos ocultos a instalaciones existentes. */
export function readHiddenModules(): string[] {
  const stored = localStorage.getItem(HIDDEN_MODULES_KEY);
  let hidden: string[] = stored ? JSON.parse(stored) : [...DEFAULT_HIDDEN_MODULES];
  if (!Array.isArray(hidden)) hidden = [...DEFAULT_HIDDEN_MODULES];

  if (localStorage.getItem(MODULE_DEFAULTS_VERSION_KEY) !== MODULE_DEFAULTS_VERSION) {
    hidden = [...new Set([...hidden, "dashboard", "analitica"])];
    localStorage.setItem(HIDDEN_MODULES_KEY, JSON.stringify(hidden));
    localStorage.setItem(MODULE_DEFAULTS_VERSION_KEY, MODULE_DEFAULTS_VERSION);
  }
  return hidden;
}

export const DEFAULT_ADVANCED_REPORTS_VISIBLE = false;
