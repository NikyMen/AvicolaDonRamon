"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Coupon, Product } from "@/lib/types";
import { deleteCouponAction, saveCouponAction, type CouponActionState } from "./actions";

export function CouponsManager({ coupons, products }: { coupons: Coupon[]; products: Product[] }) {
  const [editing, setEditing] = useState<Coupon | undefined | null>(null);
  const [error, setError] = useState("");

  async function remove(coupon: Coupon) {
    if (!confirm(`¿Eliminar la regla ${coupon.code}?`)) return;
    const result = await deleteCouponAction(coupon.id);
    setError(result.error ?? "");
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Cupones y promos</h1>
        <p className="text-sm text-brand-ink/55">Códigos de descuento y reglas comerciales automáticas.</p>
      </div>
      <button className="btn-primary" onClick={() => setEditing(undefined)}><Plus size={16} /> Nueva regla</button>
    </div>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl bg-white shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50"><tr>
          <th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Usos</th><th className="px-4 py-3">Regla / beneficio</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
        </tr></thead>
        <tbody>{coupons.map((c) => <tr key={c.id} className="border-t border-black/5">
          <td className="px-4 py-3 font-bold text-brand-ink">{c.kind === "second_unit" ? "Promo automática" : c.code}</td>
          <td className="px-4 py-3">{c.usedCount} / {c.maxUses}</td>
          <td className="px-4 py-3 text-brand-ink/70">
            {c.kind === "second_unit" && <div>2ª unidad de {c.discountProductName ?? "producto"} al {100 - c.discountPercent}%</div>}
            {c.kind === "three_for_two" && <div>3x2 en {c.discountProductName ?? "producto"}</div>}
            {c.kind === "coupon" && c.discountPercent > 0 && <div>{c.discountPercent}% {c.discountProductName ? `en ${c.discountProductName}` : "en todo el carrito"}</div>}
            {c.giftProductName && <div>{c.giftQty}x {c.giftProductName} de regalo</div>}
            {c.firstPurchaseOnly && <div className="text-xs font-semibold text-brand-red">Solo 1ª compra (por teléfono)</div>}
            {c.oncePerPhone && <div className="text-xs font-semibold text-brand-red">Un uso por teléfono</div>}
          </td>
          <td className="px-4 py-3"><span className={`chip ${c.active && c.usedCount < c.maxUses ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{c.active && c.usedCount < c.maxUses ? "Activo" : "Inactivo"}</span></td>
          <td className="px-4 py-3 text-right"><div className="inline-flex gap-2">
            <button onClick={() => setEditing(c)} className="rounded-lg border border-black/10 p-2 hover:bg-black/5" aria-label="Editar"><Pencil size={15} /></button>
            <button onClick={() => remove(c)} className="rounded-lg border border-black/10 p-2 text-brand-red hover:bg-red-50" aria-label="Eliminar"><Trash2 size={15} /></button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {coupons.length === 0 && <p className="p-8 text-center text-sm text-brand-ink/50">Todavía no hay cupones ni promos.</p>}
    </div>
    {editing !== null && <CouponModal coupon={editing} products={products} onClose={() => setEditing(null)} />}
  </div>;
}

function CouponModal({ coupon, products, onClose }: { coupon?: Coupon; products: Product[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<CouponActionState, FormData>(saveCouponAction, {});
  const [kind, setKind] = useState<Coupon["kind"]>(coupon?.kind ?? "coupon");
  useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{coupon ? `Editar ${coupon.kind === "second_unit" ? "promo" : coupon.code}` : "Nueva regla"}</h2><button onClick={onClose}><X size={18} /></button></div>
      <form action={action} className="space-y-4 text-sm">
        {coupon && <input type="hidden" name="id" value={coupon.id} />}
        <Field label="Tipo de regla">
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Coupon["kind"])} className="input-admin">
            <option value="coupon">Cupón con código</option>
            <option value="three_for_two">Cupón 3x2</option>
            <option value="second_unit">Promo automática: segunda unidad</option>
          </select>
        </Field>
        {kind === "coupon" ? (
          <>
            <Field label="Código"><input name="code" defaultValue={coupon?.code} placeholder="PATITAS10" required className="input-admin uppercase" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad de usos válidos"><input name="maxUses" type="number" min="1" defaultValue={coupon?.maxUses ?? 100} required className="input-admin" /></Field>
              <Field label="Descuento (%)"><input name="discountPercent" type="number" min="0" max="99" defaultValue={coupon?.discountPercent ?? 0} required className="input-admin" /></Field>
            </div>
            <Field label="Producto con descuento"><select name="discountProductId" defaultValue={coupon?.discountProductId ?? ""} className="input-admin"><option value="">Todos los productos</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Producto de regalo (opcional)"><select name="giftProductId" defaultValue={coupon?.giftProductId ?? ""} className="input-admin"><option value="">Sin regalo</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Cantidad"><input name="giftQty" type="number" min="1" defaultValue={coupon?.giftQty ?? 1} className="input-admin" /></Field>
            </div>
            <label className="flex items-start gap-2 font-semibold"><input name="firstPurchaseOnly" type="checkbox" defaultChecked={coupon?.firstPurchaseOnly ?? false} className="mt-0.5 h-4 w-4 accent-brand-red" /> <span>Solo para la primera compra<span className="block text-xs font-normal text-brand-ink/55">Se puede usar una única vez por número de teléfono.</span></span></label>
            <label className="flex items-start gap-2 font-semibold"><input name="oncePerPhone" type="checkbox" defaultChecked={coupon?.oncePerPhone ?? false} className="mt-0.5 h-4 w-4 accent-brand-red" /> <span>Un uso por teléfono</span></label>
          </>
        ) : kind === "three_for_two" ? (
          <>
            <Field label="Código"><input name="code" defaultValue={coupon?.code} placeholder="3X2" required className="input-admin uppercase" /></Field>
            <input type="hidden" name="discountPercent" value="0" />
            <Field label="Producto de la promoción">
              <select name="discountProductId" defaultValue={coupon?.discountProductId ?? ""} required className="input-admin">
                <option value="">Elegí un producto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Usos máximos"><input name="maxUses" type="number" min="1" defaultValue={coupon?.maxUses ?? 100000} required className="input-admin" /></Field>
            <label className="flex items-start gap-2 font-semibold"><input name="oncePerPhone" type="checkbox" defaultChecked={coupon?.oncePerPhone ?? true} className="mt-0.5 h-4 w-4 accent-brand-red" /> <span>Un uso por teléfono</span></label>
            <p className="rounded-lg bg-brand-gold/20 px-3 py-2 text-xs text-brand-ink/70">Cada 3 unidades del producto, el cupón descuenta 1 unidad completa.</p>
          </>
        ) : (
          <>
            <input type="hidden" name="code" value={coupon?.code ?? ""} />
            <Field label="Producto de la promoción">
              <select name="discountProductId" defaultValue={coupon?.discountProductId ?? ""} required className="input-admin">
                <option value="">Elegí un producto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usos máximos"><input name="maxUses" type="number" min="1" defaultValue={coupon?.maxUses ?? 100000} required className="input-admin" /></Field>
              <Field label="Descuento en 2ª unidad (%)"><input name="discountPercent" type="number" min="1" max="99" defaultValue={coupon?.discountPercent || 50} required className="input-admin" /></Field>
            </div>
            <p className="rounded-lg bg-brand-gold/20 px-3 py-2 text-xs text-brand-ink/70">Se aplica sola al sumar 2 unidades: cada par descuenta una segunda unidad. En 4 unidades se aplica dos veces.</p>
          </>
        )}
        <label className="flex items-center gap-2 font-semibold"><input name="active" type="checkbox" defaultChecked={coupon?.active ?? true} className="h-4 w-4 accent-brand-red" /> Regla activa</label>
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 font-semibold">Cancelar</button><button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button></div>
      </form>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-brand-ink/70">{label}</span>{children}</label>;
}
