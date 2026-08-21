"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Flame, Trash2 } from "lucide-react";
import type { Product, SuperOferta } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/cn";
import { prepareImageFile } from "@/lib/image-client";
import { saveSuperOferta, type SaveSuperOfertaState } from "./actions";

/**
 * Editor del banner "Super Oferta" de la home: producto destacado con precio
 * de oferta y fondo en imagen o video mp4 (para animaciones generadas).
 */
export function SuperOfertaEditor({
  oferta,
  products,
}: {
  oferta: SuperOferta;
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState<SaveSuperOfertaState, FormData>(
    saveSuperOferta,
    {}
  );
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState({
    title: oferta.title,
    price: String(oferta.price),
    oldPrice: oferta.oldPrice != null ? String(oferta.oldPrice) : "",
    image: oferta.image,
    video: oferta.video ?? "",
  });

  const previewPrice = Number(preview.price) || 0;
  const previewOld = Number(preview.oldPrice) || 0;
  const discount =
    previewOld > previewPrice && previewPrice > 0
      ? Math.round((1 - previewPrice / previewOld) * 100)
      : null;

  async function handleImageFile(file: File) {
    setImageError("");
    setProcessingImage(true);
    try {
      const preparedFile = await prepareImageFile(file);
      const input = imageInputRef.current;
      if (!input) throw new Error("No se pudo preparar la imagen.");
      const transfer = new DataTransfer();
      transfer.items.add(preparedFile);
      input.files = transfer.files;
      if (preview.image.startsWith("blob:")) URL.revokeObjectURL(preview.image);
      setPreview((current) => ({ ...current, image: URL.createObjectURL(preparedFile) }));
    } catch (error) {
      if (imageInputRef.current) imageInputRef.current.value = "";
      setImageError(error instanceof Error ? error.message : "No se pudo preparar la imagen.");
    } finally {
      setProcessingImage(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleImageFile(file);
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleImageFile(file);
  }

  function handleRemoveImage() {
    setImageError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (preview.image.startsWith("blob:")) URL.revokeObjectURL(preview.image);
    setPreview((current) => ({ ...current, image: "" }));
  }

  useEffect(() => {
    return () => {
      if (preview.image.startsWith("blob:")) URL.revokeObjectURL(preview.image);
    };
  }, [preview.image]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-soft">
      <div className="border-b border-black/5 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
          <Flame size={18} className="text-brand-red" /> Super Oferta (banner principal)
        </h2>
        <p className="text-sm text-brand-ink/55">
          Es el banner grande de la home. Editá producto, precio, imagen y video mp4 en loop.
        </p>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr,380px]">
        <form action={formAction} className="space-y-4 text-sm">
          <Field label="Título (producto destacado)">
            <input
              name="title"
              defaultValue={oferta.title}
              required
              className="input-admin"
              onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
            />
          </Field>

          <Field label="Subtítulo (opcional)">
            <input name="subtitle" defaultValue={oferta.subtitle} className="input-admin" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de oferta ($)">
              <input
                name="price"
                type="number"
                min={1}
                step={1}
                defaultValue={oferta.price}
                required
                className="input-admin"
                onChange={(e) => setPreview((p) => ({ ...p, price: e.target.value }))}
              />
            </Field>
            <Field label="Precio anterior ($, tachado — opcional)">
              <input
                name="oldPrice"
                type="number"
                min={1}
                step={1}
                defaultValue={oferta.oldPrice}
                className="input-admin"
                onChange={(e) => setPreview((p) => ({ ...p, oldPrice: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Imagen / póster del banner">
            <input
              ref={imageInputRef}
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff"
              className="sr-only"
              onChange={handleImageChange}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => imageInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") imageInputRef.current?.click();
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleImageDrop}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors",
                dragActive
                  ? "border-brand-red bg-brand-red/5"
                  : "border-brand-ink/15 hover:border-brand-red/50 hover:bg-brand-cream/40"
              )}
            >
              {preview.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview.image}
                  alt="Vista previa"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  onLoad={(e) => ((e.target as HTMLImageElement).style.visibility = "visible")}
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-cream text-2xl">
                  🖼️
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-brand-ink">
                  {processingImage ? "Procesando imagen…" : "Elegí o arrastrá una imagen"}
                </p>
                <p className="text-xs text-brand-ink/55">
                  JPG, JPEG, PNG, WEBP, GIF, AVIF, BMP o TIFF · hasta 10 MB
                </p>
              </div>
            </div>
            {preview.image && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 size={14} /> Quitar imagen
              </button>
            )}
            <input
              name="image"
              value={preview.image}
              required
              className="input-admin"
              onChange={(e) => {
                if (imageInputRef.current?.files?.length) imageInputRef.current.value = "";
                if (preview.image.startsWith("blob:")) URL.revokeObjectURL(preview.image);
                setPreview((p) => ({ ...p, image: e.target.value }));
              }}
              placeholder="También podés pegar una URL o ruta (ej. /banner.jpg)"
            />
            {imageError && <p className="mt-1 text-xs text-red-700">{imageError}</p>}
          </Field>

          <Field label="Video mp4 (opcional para animación)">
            <input
              name="video"
              defaultValue={oferta.video}
              placeholder="/super-oferta.mp4 o https://..."
              className="input-admin"
              onChange={(e) => setPreview((p) => ({ ...p, video: e.target.value }))}
            />
          </Field>

          <Field label="Producto y cantidad del botón “Pedila ahora”">
            <div className="grid grid-cols-[1fr,120px] gap-3">
              <select
                name="cartProductId"
                defaultValue={oferta.cartProductId}
                required
                className="input-admin"
              >
                {products.length === 0 && <option value="">No hay productos</option>}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                name="cartQuantity"
                type="number"
                min={1}
                step={1}
                defaultValue={oferta.cartQuantity}
                required
                className="input-admin"
                aria-label="Cantidad a agregar"
              />
            </div>
            <p className="mt-1 text-xs font-normal text-brand-ink/55">
              Al hacer clic, agrega esta cantidad del producto al carrito.
            </p>
          </Field>

          <label className="flex items-center gap-2 font-semibold text-brand-ink">
            <input
              name="active"
              type="checkbox"
              defaultChecked={oferta.active}
              className="h-4 w-4 accent-brand-red"
            />
            Visible en la home (si se desactiva, vuelve el banner clásico)
          </label>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>
          )}
          {state.ok && !pending && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
              Super oferta guardada. Ya se ve en la home.
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={pending || processingImage} className="btn-primary">
              {processingImage ? "Procesando imagen…" : pending ? "Guardando…" : "Guardar super oferta"}
            </button>
          </div>
        </form>

        {/* Vista previa del banner */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-ink/45">
            Vista previa
          </p>
          <div className="relative overflow-hidden rounded-xl bg-brand-ink">
            <div className="absolute inset-0">
              {preview.video ? (
                <video
                  key={preview.video}
                  src={preview.video}
                  poster={preview.image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover object-[68%_center]"
                />
              ) : preview.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview.image}
                  alt="Vista previa"
                  className="h-full w-full object-cover object-[68%_center]"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  onLoad={(e) => ((e.target as HTMLImageElement).style.visibility = "visible")}
                />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/95 via-black/55 to-black/10" />
            <div className="relative flex min-h-[200px] flex-col justify-end gap-1 p-4">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-brand-ink">
                <Flame size={10} /> Super oferta del día
              </span>
              <p className="font-display text-lg font-bold uppercase leading-tight text-white">
                {preview.title || "Título del producto"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-extrabold text-brand-gold">
                  {previewPrice > 0 ? formatARS(previewPrice) : "$ —"}
                </span>
                {previewOld > previewPrice && (
                  <span className="text-sm text-white/60 line-through">
                    {formatARS(previewOld)}
                  </span>
                )}
                {discount !== null && (
                  <span className="rounded bg-white px-1.5 py-0.5 text-xs font-extrabold text-brand-red">
                    -{discount}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-brand-ink/45">
            Para el video: mp4 corto (5-15 s), apaisado (ideal 1600x900 o similar), sin audio.
            Subilo a <code>/public</code> del sitio o usá una URL externa.
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}
