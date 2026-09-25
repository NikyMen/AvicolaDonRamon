"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import type { WholesaleProduct } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAdminSearch } from "@/lib/admin-search";
import { parseWholesaleSheet } from "@/lib/wholesale-import";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  deleteWholesaleProductAction,
  importWholesaleProductsAction,
  saveWholesaleProductAction,
  toggleWholesaleAvailabilityAction,
  type WholesaleActionState,
} from "./actions";

type SortKey = "name" | "category" | "price" | "stock" | "status";
type SortDir = "asc" | "desc";

const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Producto" },
  { key: "category", label: "Categoría" },
  { key: "price", label: "Precio mayorista" },
  { key: "stock", label: "Stock" },
  { key: "status", label: "Estado" },
];

function inStock(p: WholesaleProduct): boolean {
  return p.stock === null || p.stock > 0;
}

function statusRank(p: WholesaleProduct): number {
  if (!p.available) return 0;
  if (!inStock(p)) return 1;
  return 2;
}

export function WholesaleManager({ products }: { products: WholesaleProduct[] }) {
  // Copia local para reflejar cambios al instante (se resincroniza con el servidor).
  const [items, setItems] = useState(products);
  useEffect(() => setItems(products), [products]);

  // null = cerrado, undefined = crear nuevo, WholesaleProduct = editar
  const [editing, setEditing] = useState<WholesaleProduct | undefined | null>(null);
  const [importing, setImporting] = useState(false);
  const [toDelete, setToDelete] = useState<WholesaleProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const search = useAdminSearch();
  const query = search?.query.trim().toLowerCase() ?? "";

  const categories = useMemo(
    () => [...new Set(items.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter((p) =>
      [p.name, p.description, p.category, p.code].some((value) => value?.toLowerCase().includes(query))
    );
  }, [items, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "category":
          return a.category.localeCompare(b.category) * dir;
        case "price":
          return (a.price - b.price) * dir;
        case "stock":
          return ((a.stock ?? Number.MAX_SAFE_INTEGER) - (b.stock ?? Number.MAX_SAFE_INTEGER)) * dir;
        case "status":
          return (statusRank(a) - statusRank(b)) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function handleToggleAvailability(product: WholesaleProduct, available: boolean) {
    setItems((current) => current.map((p) => (p.id === product.id ? { ...p, available } : p)));
    void toggleWholesaleAvailabilityAction(product.id, available).then((result) => {
      if (!result.error) return;
      setError(result.error);
      setItems((current) =>
        current.map((p) => (p.id === product.id ? { ...p, available: product.available } : p))
      );
    });
  }

  function handleDelete() {
    if (!toDelete) return;
    const product = toDelete;
    setDeleting(true);
    void deleteWholesaleProductAction(product.id)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setItems((current) => current.filter((p) => p.id !== product.id));
        setToDelete(null);
      })
      .finally(() => setDeleting(false));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Stock mayorista</h1>
          <p className="text-sm text-brand-ink/55">
            {sorted.length === items.length
              ? `${items.length} productos en la lista mayorista`
              : `${sorted.length} de ${items.length} productos`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setImporting(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-brand-ink/75 hover:bg-black/5"
          >
            <FileSpreadsheet size={16} /> Importar desde Excel
          </button>
          <button className="btn-primary" onClick={() => setEditing(undefined)}>
            <Plus size={16} /> Agregar producto
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900">
        <Wallet size={18} className="mt-0.5 shrink-0" />
        <p>
          El asistente de WhatsApp usa solo esta lista con los contactos en <strong>cuenta corriente</strong>.
          Si un producto no figura acá, les deriva la consulta a una persona en vez de pasar el precio minorista.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-brand-ink"
                    >
                      {col.label}
                      {sort?.key === col.key ? (
                        sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className="cursor-pointer border-t border-black/5 hover:bg-brand-cream/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-ink">{p.name}</p>
                    <p className="text-xs text-brand-ink/50">
                      {[p.code && `Cód. ${p.code}`, p.description].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-brand-ink/70">{p.category || "—"}</td>
                  <td className="px-4 py-3 font-medium text-brand-ink">{formatARS(p.price)}</td>
                  <td className="px-4 py-3">
                    {p.stock === null ? (
                      <span className="text-xs text-brand-ink/50">Sin control</span>
                    ) : (
                      <>
                        <span className={cn("font-semibold", p.stock > 0 ? "text-brand-ink" : "text-brand-red")}>
                          {p.stock}
                        </span>
                        <span className="ml-1 text-xs text-brand-ink/50">u.</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAvailability(p, !p.available);
                      }}
                      title="Cambiar disponibilidad"
                      className={cn(
                        "chip cursor-pointer",
                        p.available && inStock(p) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {!p.available ? "Pausado" : inStock(p) ? "A la venta" : "Sin stock"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(p);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setError("");
                          setToDelete(p);
                        }}
                        title="Eliminar producto"
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-brand-ink/50">
                    {items.length === 0
                      ? "Todavía no hay productos mayoristas. Agregalos uno por uno o importá tu lista desde Excel."
                      : "No encontramos productos que coincidan con la búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <WholesaleModal product={editing} categories={categories} onClose={() => setEditing(null)} />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(message) => {
            setImporting(false);
            setNotice(`Lista importada: ${message}`);
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`¿Eliminar “${toDelete?.name}”?`}
        description="Deja de estar disponible para los clientes en cuenta corriente. Esta acción no se puede deshacer."
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function WholesaleModal({
  product,
  categories,
  onClose,
}: {
  product?: WholesaleProduct;
  categories: string[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<WholesaleActionState, FormData>(
    saveWholesaleProductAction,
    {}
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title={product ? `Editar: ${product.name}` : "Nuevo producto mayorista"} onClose={onClose}>
      <form action={formAction} className="space-y-4 text-sm">
        {product && <input type="hidden" name="id" value={product.id} />}

        <Field label="Nombre">
          <input name="name" defaultValue={product?.name} required maxLength={200} className="input-admin" />
        </Field>

        <Field label="Descripción o presentación (opcional)">
          <input
            name="description"
            defaultValue={product?.description}
            maxLength={500}
            placeholder="Ej.: Caja x 15 kg"
            className="input-admin"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría (opcional)">
            <input
              name="category"
              defaultValue={product?.category}
              maxLength={100}
              list="wholesale-categories"
              placeholder="Ej.: Cajones"
              className="input-admin"
            />
            <datalist id="wholesale-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Código (opcional)">
            <input name="code" defaultValue={product?.code} maxLength={100} className="input-admin" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio mayorista (ARS)">
            <input
              name="price"
              type="number"
              min={1}
              step={1}
              defaultValue={product?.price}
              required
              className="input-admin"
            />
          </Field>
          <Field label="Stock (opcional)">
            <input
              name="stock"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.stock ?? ""}
              placeholder="Sin control"
              className="input-admin"
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-brand-ink/45">
          Dejá el stock vacío si no lo controlás: el producto se ofrece mientras esté disponible.
        </p>

        <label className="flex items-center gap-2 font-semibold text-brand-ink">
          <input
            name="available"
            type="checkbox"
            defaultChecked={product?.available ?? true}
            className="h-4 w-4 accent-brand-red"
          />
          Disponible para la venta
        </label>

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/70 hover:bg-black/5"
          >
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (message: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { rows, errors } = useMemo(() => parseWholesaleSheet(text), [text]);

  function handleImport() {
    setError("");
    startTransition(async () => {
      const result = await importWholesaleProductsAction(rows);
      if (result.error) {
        setError(result.error);
        return;
      }
      onImported(result.message ?? "");
    });
  }

  return (
    <Modal title="Importar lista mayorista" onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <p className="text-brand-ink/65">
          Copiá las filas desde Excel y pegalas acá. Si la primera fila tiene encabezados, se reconocen las columnas{" "}
          <strong>Nombre</strong>, <strong>Precio</strong>, <strong>Stock</strong>, <strong>Categoría</strong>,{" "}
          <strong>Código</strong> y <strong>Descripción</strong>. Sin encabezados, el orden es: Nombre · Precio ·
          Stock · Categoría · Código. Los productos existentes se actualizan por código o por nombre.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          placeholder={"Nombre\tPrecio\tStock\nCaja pata muslo Resistire x15 kg\t35000\t20"}
          className="input-admin resize-y font-mono text-xs"
        />

        {text.trim() && (
          <div className="space-y-2">
            <p className="font-semibold text-brand-ink">
              {rows.length} {rows.length === 1 ? "fila lista" : "filas listas"} para importar
              {errors.length > 0 && <span className="text-red-700"> · {errors.length} con errores</span>}
            </p>
            {errors.length > 0 && (
              <ul className="max-h-24 list-disc overflow-y-auto rounded-lg bg-red-50 py-2 pl-7 pr-3 text-xs text-red-700">
                {errors.slice(0, 20).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {rows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border border-black/5">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-brand-cream text-left text-brand-ink/55">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Precio</th>
                      <th className="px-3 py-2">Stock</th>
                      <th className="px-3 py-2">Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, index) => (
                      <tr key={`${row.code ?? row.name}-${index}`} className="border-t border-black/5">
                        <td className="px-3 py-1.5 text-brand-ink">{row.name}</td>
                        <td className="px-3 py-1.5">{formatARS(row.price)}</td>
                        <td className="px-3 py-1.5 text-brand-ink/60">
                          {row.stock === undefined ? "Se conserva" : row.stock === null ? "Sin control" : row.stock}
                        </td>
                        <td className="px-3 py-1.5 text-brand-ink/60">{row.category ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="border-t border-black/5 px-3 py-2 text-xs text-brand-ink/50">
                    y {rows.length - 50} filas más…
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 px-4 py-2 font-semibold text-brand-ink/70 hover:bg-black/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={pending || rows.length === 0}
            className="btn-primary"
          >
            {pending ? "Importando…" : `Importar ${rows.length} ${rows.length === 1 ? "producto" : "productos"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-soft",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
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
