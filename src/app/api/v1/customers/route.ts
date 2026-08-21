import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api/auth";
import { ok, handleError } from "@/lib/api/respond";
import { listCustomers, createCustomer, findCustomer } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createCustomerSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  phone: z.string().min(5, "El teléfono es obligatorio."),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const sp = req.nextUrl.searchParams;
    const phone = sp.get("phone") ?? undefined;
    const email = sp.get("email") ?? undefined;
    const search = sp.get("search") ?? undefined;

    // Búsqueda puntual por teléfono/email (devuelve un único cliente o null).
    if (phone || email) {
      return ok(await findCustomer({ phone, email }));
    }
    return ok(await listCustomers(search));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  try {
    const input = createCustomerSchema.parse(await req.json());
    return ok(await createCustomer(input), 201);
  } catch (e) {
    return handleError(e);
  }
}
