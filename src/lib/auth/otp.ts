import "server-only";
import { cookies, headers } from "next/headers";
import crypto from "crypto";

/** Tiempo de vida del código OTP. */
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutos
/** Mínimo entre dos envíos al mismo teléfono (anti-spam). */
export const OTP_RESEND_MS = 60 * 1000; // 60 segundos
/** Intentos de verificación permitidos antes de invalidar el código. */
export const OTP_MAX_ATTEMPTS = 5;
/** Cantidad de dígitos del código enviado por WhatsApp. */
export const OTP_CODE_LENGTH = 4;
const OTP_COOKIE = "polleria_otp";

// La normalización vive en @/lib/phone (módulo puro, compartido con el
// checkout y el panel). Se reexporta acá para no romper los imports existentes
// y, sobre todo, para que el login y las compras usen SIEMPRE la misma clave.
import { normalizePhone } from "@/lib/phone";

export { normalizePhone, isValidPhone } from "@/lib/phone";

/** Genera un código numérico de 4 dígitos. */
export function generateCode(): string {
  return String(crypto.randomInt(10 ** (OTP_CODE_LENGTH - 1), 10 ** OTP_CODE_LENGTH));
}

/**
 * Hash del código ligado al teléfono. Usamos HMAC con `SESSION_SECRET` (o un
 * fallback en dev) para no guardar el código en claro en la base.
 */
export function hashCode(phone: string, code: string): string {
  const key = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return crypto.createHmac("sha256", key).update(`${phone}:${code}`).digest("hex");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(payload: string): string {
  const key = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return b64url(crypto.createHmac("sha256", key).update(payload).digest());
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}

/** Guarda un respaldo del OTP en cookie httpOnly para entornos sin DB estable. */
export async function setOtpCookie(phone: string, codeHash: string, expiresAt: Date): Promise<void> {
  const payload = b64url(Buffer.from(JSON.stringify({ phone, codeHash, exp: expiresAt.getTime() })));
  const store = await cookies();
  store.set(OTP_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
  });
}

export async function verifyOtpCookie(phone: string, codeHash: string) {
  const store = await cookies();
  const token = store.get(OTP_COOKIE)?.value;
  if (!token) return "none" as const;

  const dot = token.lastIndexOf(".");
  if (dot < 0) return "none" as const;
  const payload = token.slice(0, dot);
  if (token.slice(dot + 1) !== sign(payload)) return "none" as const;

  const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as {
    phone: string;
    codeHash: string;
    exp: number;
  };
  if (data.phone !== phone) return "none" as const;
  if (data.exp < Date.now()) {
    store.delete(OTP_COOKIE);
    return "expired" as const;
  }
  if (data.codeHash !== codeHash) return "invalid" as const;
  store.delete(OTP_COOKIE);
  return "ok" as const;
}

/**
 * Envía el código al cliente por WhatsApp usando un webhook de n8n.
 *
 * Hace POST a `OTP_WHATSAPP_WEBHOOK_URL` con `{ phone, code, message }`.
 * Si la variable no está configurada, en desarrollo loguea el código por
 * consola (para poder probar sin n8n) y en producción lanza un error.
 */
export type OtpDelivery = "whatsapp" | "console";

export async function sendOtp(phone: string, code: string): Promise<OtpDelivery> {
  const url = process.env.OTP_WHATSAPP_WEBHOOK_URL;
  const message = `Tu código de acceso a Avícola Don Ramón es ${code}. Vence en 5 minutos. No lo compartas con nadie.`;
  const shouldLogCode =
    process.env.OTP_LOG_CODE === "true" ||
    process.env.OTP_LOG_FALLBACK === "true" ||
    process.env.NODE_ENV !== "production";

  if (shouldLogCode) {
    console.info(`[OTP] Código para ${phone}: ${code}`);
  }

  if (!url) {
    // OTP_LOG_FALLBACK=true permite operar sin n8n: el código se imprime en
    // los logs de PM2 (`pm2 logs avicola-don-ramon`) en vez de enviarse.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.OTP_LOG_FALLBACK !== "true" &&
      process.env.OTP_LOG_CODE !== "true"
    ) {
      throw new Error("OTP_WHATSAPP_WEBHOOK_URL no está configurado.");
    }
    return "console";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.OTP_WEBHOOK_SECRET
        ? { authorization: `Bearer ${process.env.OTP_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify({ phone, code, message }),
    signal: AbortSignal.timeout(10_000),
  });

  const responseBody = await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`[OTP] webhook respondió ${res.status}: ${responseBody.slice(0, 300)}`);
    throw new Error(`El webhook de WhatsApp respondió ${res.status}.`);
  }

  console.info(`[OTP] webhook aceptó el envío para ${phone} (${res.status}).`);

  return "whatsapp";
}

/** Indica si un teléfono pertenece a un administrador (env `ADMIN_PHONES`). */
export function isAdminPhone(phone: string): boolean {
  const list = (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => normalizePhone(p))
    .filter(Boolean);
  return list.includes(normalizePhone(phone));
}
