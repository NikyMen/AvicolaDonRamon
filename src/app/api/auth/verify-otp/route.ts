import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api/respond";
import { normalizePhone, hashCode, OTP_CODE_LENGTH, verifyOtpCookie } from "@/lib/auth/otp";
import { findCustomer, verifyOtp, loginByPhone } from "@/lib/repo";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(5, "El teléfono es obligatorio."),
  code: z.coerce
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(
      z.string().regex(
        new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`),
        `El código debe tener ${OTP_CODE_LENGTH} dígitos.`
      )
  ),
  name: z.string().trim().min(1).max(80).optional(),
  document: z.string().trim().min(3).max(30).optional(),
  email: z.string().trim().email("El correo no es válido.").max(160).optional(),
});

const messages: Record<string, string> = {
  expired: "El código venció. Pedí uno nuevo.",
  locked: "Demasiados intentos. Pedí un código nuevo.",
  invalid: "El código no es correcto.",
  none: "No hay un código pendiente para este número. Pedí uno nuevo.",
};

/** Verifica el OTP, crea/recupera el cliente y abre la sesión. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const phone = normalizePhone(body.phone);
    const codeInput = body.code;
    const existingCustomer = await findCustomer({ phone });
    if (!existingCustomer && (!body.name || !body.document || !body.email)) {
      return fail(
        "Para crear tu cuenta completá nombre, documento y correo.",
        422,
        "PROFILE_REQUIRED"
      );
    }

    // Código demo: permite entrar sin OTP real (para muestras / entornos sin WhatsApp).
    const demoCode = process.env.DEMO_LOGIN_CODE ?? (process.env.NODE_ENV === "production" ? "" : "1234");
    const isDemo = demoCode.length === OTP_CODE_LENGTH && codeInput === demoCode;

    const codeHash = hashCode(phone, codeInput);
    const result = isDemo
      ? "ok"
      : await verifyOtp(phone, codeHash).then((r) =>
          r === "none" ? verifyOtpCookie(phone, codeHash) : r
        );
    if (result !== "ok") {
      console.warn(`[OTP] Verificación fallida para ${phone}: ${result}.`);
      const code = result === "invalid" ? "INVALID_CODE" : "OTP_" + result.toUpperCase();
      return fail(messages[result] ?? "No se pudo verificar el código.", 401, code);
    }

    const subject = await loginByPhone({
      phone,
      name: body.name,
      document: body.document,
      email: body.email,
    });
    await setSessionCookie({
      sub: subject.id,
      name: subject.name,
      phone: subject.phone,
      role: subject.role,
    });

    return ok({ id: subject.id, name: subject.name, phone: subject.phone, role: subject.role });
  } catch (e) {
    return handleError(e);
  }
}
