import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripImageVersion } from "./image-url";

export const PRODUCT_IMAGE_PREFIX = "/uploads/products/";
export const MAX_PRODUCT_IMAGE_SIZE = 10 * 1024 * 1024;

/** Evita depender de `instanceof File`, que no es confiable entre runtimes. */
export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).type === "string" &&
    typeof (value as File).size === "number"
  );
}

const PRODUCT_IMAGE_DIR = path.join(process.cwd(), "public", "uploads", "products");

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

const EXTENSION_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, extension]) => [extension, mime])
);

function hasImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mimeType === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/avif") return hasIsoBaseMediaSignature(buffer, ["avif", "avis"]);
  if (mimeType === "image/bmp") return buffer.subarray(0, 2).toString("ascii") === "BM";
  return (
    mimeType === "image/tiff" &&
    (buffer.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0])) ||
      buffer.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42])))
  );
}

function hasIsoBaseMediaSignature(buffer: Buffer, brands: string[]): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const fileBrands = buffer.subarray(8).toString("ascii");
  return brands.some((brand) => fileBrands.includes(brand));
}

export async function saveProductImage(file: File): Promise<string> {
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) throw new Error("Solo se admiten imágenes JPG, PNG, WEBP, GIF, AVIF, BMP o TIFF.");
  if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_SIZE) {
    throw new Error("La imagen debe pesar menos de 10 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasImageSignature(buffer, file.type)) throw new Error("El archivo no es una imagen válida.");

  await mkdir(PRODUCT_IMAGE_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(PRODUCT_IMAGE_DIR, filename), buffer, { flag: "wx" });
  return `${PRODUCT_IMAGE_PREFIX}${filename}`;
}

export interface ProductImageFile {
  buffer: Buffer;
  contentType: string;
}

/**
 * Lee un archivo subido directamente del disco, nunca del snapshot estático
 * que arma `next start` al arrancar: ese snapshot es fijo, así que un archivo
 * subido con el proceso ya corriendo devolvería 404 vía `/uploads/...` hasta
 * el próximo restart. Ver `src/app/api/uploads/products/[filename]/route.ts`.
 */
export async function readProductImage(filename: string): Promise<ProductImageFile | null> {
  if (!filename || filename !== path.basename(filename) || filename.includes("..")) return null;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXTENSION_CONTENT_TYPES[extension];
  if (!contentType) return null;

  try {
    const buffer = await readFile(path.join(PRODUCT_IMAGE_DIR, filename));
    return { buffer, contentType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function isProductUpload(image: string): boolean {
  image = stripImageVersion(image);
  const filename = image.startsWith(PRODUCT_IMAGE_PREFIX)
    ? image.slice(PRODUCT_IMAGE_PREFIX.length)
    : "";
  return Boolean(filename) && filename === path.basename(filename) && !filename.includes("..");
}

export async function deleteProductImage(image: string): Promise<void> {
  image = stripImageVersion(image);
  if (!isProductUpload(image)) return;
  const filename = image.slice(PRODUCT_IMAGE_PREFIX.length);
  try {
    await unlink(path.join(PRODUCT_IMAGE_DIR, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
