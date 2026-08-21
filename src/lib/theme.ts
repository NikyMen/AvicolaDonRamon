// Acentos de marca configurables desde el panel (Configuración).
// El color de acento (brand-red / brand-dark) se aplica vía variables CSS,
// de modo que las 77+ clases `brand-red` existentes lo adoptan sin cambios.

export type AccentKey = "rojo" | "azul" | "verde";

export interface AccentTheme {
  key: AccentKey;
  label: string;
  description: string;
  /** Canales RGB ("r g b") para rgb(var(--brand-red) / <alpha-value>). */
  red: string;
  /** Canales RGB del tono oscuro (hover/activo). */
  dark: string;
  /** Hex para mostrar la muestra de color en la UI. */
  swatch: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    key: "rojo",
    label: "Rojo Entre Ríos",
    description: "El color clásico de la marca.",
    red: "200 16 46",
    dark: "155 12 34",
    swatch: "#C8102E",
  },
  {
    key: "azul",
    label: "Azul",
    description: "Un acento sobrio y profesional.",
    red: "37 99 235",
    dark: "29 78 216",
    swatch: "#2563EB",
  },
  {
    key: "verde",
    label: "Verde",
    description: "Un acento fresco y natural.",
    red: "22 163 74",
    dark: "21 128 61",
    swatch: "#16A34A",
  },
];

export const DEFAULT_ACCENT: AccentKey = "rojo";
export const ACCENT_STORAGE_KEY = "panel-accent";

/** Aplica el acento a :root escribiendo las variables CSS. */
export function applyAccent(key: string): void {
  const theme = ACCENT_THEMES.find((t) => t.key === key) ?? ACCENT_THEMES[0];
  const root = document.documentElement.style;
  root.setProperty("--brand-red", theme.red);
  root.setProperty("--brand-dark", theme.dark);
}

/** Script inline para aplicar el acento antes del primer pintado (sin parpadeo). */
export function buildAccentScript(): string {
  const map = Object.fromEntries(ACCENT_THEMES.map((t) => [t.key, [t.red, t.dark]]));
  return `(function(){try{var m=${JSON.stringify(map)};var k=localStorage.getItem(${JSON.stringify(
    ACCENT_STORAGE_KEY
  )})||${JSON.stringify(DEFAULT_ACCENT)};var v=m[k];if(v){var s=document.documentElement.style;s.setProperty('--brand-red',v[0]);s.setProperty('--brand-dark',v[1]);}}catch(e){}})();`;
}
