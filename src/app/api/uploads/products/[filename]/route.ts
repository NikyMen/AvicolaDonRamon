import { NextResponse } from "next/server";
import { readProductImage } from "@/lib/product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sirve las imágenes subidas de productos/ofertas leyendo el disco en cada
 * request (ver readProductImage). `next.config.mjs` reescribe
 * `/uploads/products/:filename` hacia acá para que TODAS las requests pasen
 * por esta ruta, no solo las que Next no reconoció como archivo estático.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const image = await readProductImage(filename);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.buffer.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
