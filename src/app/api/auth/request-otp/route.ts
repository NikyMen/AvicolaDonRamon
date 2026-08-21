import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  normalizePhone,
  isValidPhone,
  generateCode,
  hashCode,
  setOtpCookie,
  sendOtp,
  OTP_TTL_MS,
} from "@/lib/auth/otp";
import { findCustomer, storeOtp } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    phone: z.string().trim().optional(),
    document: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.phone) !== Boolean(value.document), {
    message: "Ingresá un teléfono o un documento.",
  });

/** Genera un OTP, lo guarda y lo envía por WhatsApp (n8n). */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    let phone: string;
    let existingCustomer;

    if (body.document) {
      existingCustomer = await findCustomer({ document: body.document });
      if (!existingCustomer) {
        return fail(
          "No encontramos una cuenta con ese documento. Primero ingresá con tu teléfono.",
          404,
          "ACCOUNT_NOT_FOUND"
        );
      }
      phone = normalizePhone(existingCustomer.phone);
    } else {
      phone = normalizePhone(body.phone ?? "");
      if (!isValidPhone(phone)) {
        return fail("El número de teléfono no es válido.", 422, "INVALID_PHONE");
      }
      existingCustomer = await findCustomer({ phone });
    }

    const code = generateCode();
    const codeHash = hashCode(phone, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await storeOtp(phone, codeHash, expiresAt);
    await setOtpCookie(phone, codeHash, expiresAt);

    let delivery = "whatsapp";
    try {
      delivery = await sendOtp(phone, code);
    } catch (err) {
      // En desarrollo/provisorio el código ya quedó logueado por consola si
      // OTP_LOG_CODE=true; permitimos verificarlo aunque falle WhatsApp.
      if (process.env.NODE_ENV === "production" && process.env.OTP_LOG_CODE !== "true") {
        throw err;
      }
      delivery = "console";
      console.warn("[OTP] No se pudo enviar por WhatsApp; usar código de consola:", err);
    }

    console.info(`[OTP] Código generado para ${phone}. Entrega: ${delivery}.`);
    return ok({
      sent: delivery === "whatsapp",
      delivery,
      phone,
      expiresInSec: OTP_TTL_MS / 1000,
      isFirstLogin: !existingCustomer,
    });
  } catch (e) {
    return handleError(e);
  }
}
