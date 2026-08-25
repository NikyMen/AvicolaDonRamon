/** Preferencias visuales locales del panel. No son datos de negocio. */
export const HIDDEN_MODULES_KEY = "admin:hidden-modules";
export const ADVANCED_REPORTS_KEY = "admin:advanced-report-data";
export const ADMIN_PREFERENCES_EVENT = "admin-preferences-change";

export const DEFAULT_HIDDEN_MODULES = [
  "entregas",
  "envios",
  "ofertas",
  "clientes",
  "cupones",
] as const;

export const DEFAULT_ADVANCED_REPORTS_VISIBLE = false;
