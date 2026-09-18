"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ShieldCheck,
  TicketPercent,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type { Coupon, Product } from "@/lib/types";
import {
  deleteCouponAction,
  saveCouponAction,
  setCouponActiveAction,
  type CouponActionState,
} from "./actions";

type Filter = "todos" | "activos" | "inactivos";

export function CouponsManager({
  coupons,
  products,
  canManageCoupons,
}: {
  coupons: Coupon[];
  products: Product[];
  canManageCoupons: boolean;
}) {
  const [editing, setEditing] = useState<Coupon | undefined | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.active && c.remainingUses > 0).length;
    const inactive = coupons.length - active;
    const remaining = coupons.reduce((sum, c) => sum + c.remainingUses, 0);
    return { active, inactive, remaining };
  }, [coupons]);

  const visibleCoupons = coupons.filter((coupon) => {
    const active = coupon.active && coupon.remainingUses > 0;
    if (filter === "activos") return active;
    if (filter === "inactivos") return !active;
    return true;
  });

  async function remove(coupon: Coupon) {
    if (!confirm(`¿Eliminar el cupón ${coupon.code}?`)) return;
    const result = await deleteCouponAction(coupon.id);
    setError(result.error ?? "");
  }

  async function toggle(coupon: Coupon) {
    const result = await setCouponActiveAction(coupon.id, !coupon.active);
    setError(result.error ?? "");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Cupones</h1>
          <p className="text-sm text-brand-ink/55">
            Códigos seguros, no acumulables y limitados a un uso por cliente.
          </p>
        </div>
        {canManageCoupons ? (
          <button className="btn-primary" onClick={() => setEditing(undefined)}>
            <Plus size={16} /> Nuevo cupón
          </button>
        ) : (
          <div className="rounded-lg border border-brand-red/15 bg-brand-red/5 px-3 py-2 text-xs font-semibold text-brand-red">
            Solo administradores o encargados pueden crear cupones.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Activos" value={stats.active} tone="emerald" />
        <Metric label="Inactivos o agotados" value={stats.inactive} tone="red" />
        <Metric label="Disponibles ahora" value={stats.remaining} tone="ink" />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-2 shadow-soft">
        <div className="inline-flex rounded-lg bg-brand-cream p-1 text-xs font-bold text-brand-ink/60">
          {(["todos", "activos", "inactivos"] as Filter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${
                filter === item ? "bg-white text-brand-ink shadow-soft" : "hover:text-brand-ink"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-brand-ink/45">El contador se actualiza al crear, editar o activar cupones.</p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
            <tr>
              <th className="px-4 py-3">Cupón</th>
              <th className="px-4 py-3">Beneficio</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Restantes</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleCoupons.map((c) => {
              const usable = c.active && c.remainingUses > 0;
              return (
                <tr key={c.id} className="border-t border-black/5">
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-ink">{c.code}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold text-brand-ink/55">
                      <span className="chip bg-brand-cream text-brand-ink/70">ID {c.id.slice(0, 8)}</span>
                      <span className="chip bg-emerald-50 text-emerald-700">1 uso por cliente</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CouponTypeBadge coupon={c} />
                  </td>
                  <td className="px-4 py-3 text-brand-ink/65">{formatRange(c)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-ink">{c.remainingUses}</div>
                    <div className="text-xs text-brand-ink/45">
                      {c.usedCount} usados
                      {c.activeReservations > 0 ? ` · ${c.activeReservations} reservados` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${usable ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {usable ? "Activo" : c.remainingUses <= 0 ? "Agotado" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManageCoupons ? (
                      <div className="inline-flex gap-2">
                        <button onClick={() => toggle(c)} className="rounded-lg border border-black/10 p-2 transition hover:bg-black/5" aria-label={c.active ? "Desactivar" : "Activar"}>
                          {c.active ? <ToggleRight size={17} className="text-emerald-600" /> : <ToggleLeft size={17} />}
                        </button>
                        <button onClick={() => setEditing(c)} className="rounded-lg border border-black/10 p-2 transition hover:bg-black/5" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(c)} className="rounded-lg border border-black/10 p-2 text-brand-red transition hover:bg-red-50" aria-label="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-brand-ink/35">Solo lectura</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleCoupons.length === 0 && <p className="p-8 text-center text-sm text-brand-ink/50">No hay cupones para este filtro.</p>}
      </div>

      {editing !== null && canManageCoupons && <CouponModal coupon={editing} products={products} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Metric({ label, value, tone, pulse }: { label: string; value: number; tone: "emerald" | "red" | "ink"; pulse?: boolean }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-brand-red" : "text-brand-ink";
  return (
    <div className="rounded-xl border border-black/5 bg-white px-4 py-3 shadow-soft">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-ink/40">{label}</div>
      <div className={`mt-1 text-2xl font-black ${color} ${pulse ? "animate-pulse" : ""}`}>{value}</div>
    </div>
  );
}

function CouponTypeBadge({ coupon }: { coupon: Coupon }) {
  const badges = [];
  if (coupon.couponType === "precio" || coupon.couponType === "precio_envio") {
    badges.push(
      <span key="precio" className="chip bg-brand-gold/25 text-brand-ink">
        <TicketPercent size={13} /> {coupon.kind === "three_for_two" ? "3x2" : coupon.discountPercent > 0 ? `${coupon.discountPercent}%` : "Regalo"}
      </span>
    );
  }
  if (coupon.couponType === "envio" || coupon.couponType === "precio_envio") {
    badges.push(
      <span key="envio" className="chip bg-sky-100 text-sky-700">
        <Truck size={13} /> {coupon.shippingDiscountPercent}% envio
      </span>
    );
  }
  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

function formatRange(coupon: Coupon) {
  if (!coupon.startsAt || !coupon.endsAt) return "Sin rango";
  return `${formatDisplayDate(coupon.startsAt)} al ${formatDisplayDate(coupon.endsAt)}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" })
    .format(date)
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function CouponModal({ coupon, products, onClose }: { coupon?: Coupon; products: Product[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<CouponActionState, FormData>(saveCouponAction, {});
  const [kind, setKind] = useState<Coupon["kind"]>(coupon?.kind ?? "coupon");
  const [priceBenefit, setPriceBenefit] = useState(coupon ? coupon.couponType !== "envio" : true);
  const [shippingBenefit, setShippingBenefit] = useState(coupon ? coupon.couponType !== "precio" : false);
  const [startsAt, setStartsAt] = useState(coupon?.startsAt ?? todayDate());
  const [endsAt, setEndsAt] = useState(coupon?.endsAt ?? coupon?.startsAt ?? todayDate());
  const [giftProductId, setGiftProductId] = useState(coupon?.giftProductId ?? "");
  const [giftQty, setGiftQty] = useState(coupon?.giftQty ?? 1);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    if (!priceBenefit || shippingBenefit) setKind("coupon");
  }, [priceBenefit, shippingBenefit]);

  return (
    <div className="coupon-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-6 pt-20 md:pt-24">
      <div className="coupon-modal-in max-h-[calc(100vh-7rem)] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-ink">{coupon ? `Editar ${coupon.code}` : "Crear cupón"}</h2>
            <p className="text-xs font-semibold text-brand-ink/50">Código único, uso único por cliente y sin acumulación.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form action={action} className="space-y-4 text-sm">
          {coupon && <input type="hidden" name="id" value={coupon.id} />}

          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Field label="Código">
              <input
                name="code"
                defaultValue={coupon?.code}
                placeholder="FACU12"
                pattern="(?=.*[0-9])[A-Za-z0-9_-]{3,30}"
                minLength={3}
                maxLength={30}
                required
                className="input-admin uppercase transition hover:border-brand-red/30"
              />
            </Field>
            <Field label="Cantidad disponible">
              <input name="maxUses" type="number" min="1" defaultValue={coupon?.maxUses ?? 100} required className="input-admin" />
            </Field>
          </div>

          <Field label="Beneficios">
            <div className="grid gap-2 md:grid-cols-2">
              <CheckCard name="benefitPrice" checked={priceBenefit} onChange={setPriceBenefit} icon={<TicketPercent size={17} />} title="Descuento" description="Precio o regalo en productos" />
              <CheckCard name="benefitShipping" checked={shippingBenefit} onChange={setShippingBenefit} icon={<Truck size={17} />} title="Envio" description="Reducción del costo de envio" />
            </div>
          </Field>

          <Field label="Calendario de vigencia">
            <DateRangePicker startsAt={startsAt} endsAt={endsAt} onChange={(start, end) => {
              setStartsAt(start);
              setEndsAt(end);
            }} />
            <input type="hidden" name="startsAt" value={startsAt} />
            <input type="hidden" name="endsAt" value={endsAt} />
          </Field>

          {priceBenefit && !shippingBenefit && (
            <Field label="Regla de descuento">
              <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Coupon["kind"])} className="input-admin">
                <option value="coupon">Código con descuento</option>
                <option value="three_for_two">Código 3x2</option>
                <option value="second_unit">Promo automática: segunda unidad</option>
              </select>
            </Field>
          )}
          {(!priceBenefit || shippingBenefit) && <input type="hidden" name="kind" value="coupon" />}

          {priceBenefit && (
            <div className="space-y-3 rounded-lg border border-black/10 p-3">
              {kind === "three_for_two" ? (
                <input type="hidden" name="discountPercent" value="0" />
              ) : kind === "second_unit" ? (
                <Field label="Descuento en segunda unidad (%)">
                  <input name="discountPercent" type="number" min="1" max="99" defaultValue={coupon?.discountPercent || 50} required className="input-admin" />
                </Field>
              ) : (
                <Field label="Descuento de precio (%)">
                  <input name="discountPercent" type="number" min="0" max="99" defaultValue={coupon?.discountPercent ?? 10} required className="input-admin" />
                </Field>
              )}

              <ProductChecklist products={products} selectedIds={coupon?.discountProductIds ?? []} />

              {kind === "coupon" && (
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <Field label="Producto de regalo">
                    <select
                      name="giftProductId"
                      value={giftProductId}
                      onChange={(event) => setGiftProductId(event.target.value)}
                      className="input-admin"
                    >
                      <option value="">Sin regalo</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input
                      name="giftQty"
                      type="number"
                      min="1"
                      value={giftProductId ? giftQty : ""}
                      onChange={(event) => setGiftQty(Number(event.target.value))}
                      disabled={!giftProductId}
                      className="input-admin disabled:cursor-not-allowed disabled:bg-black/5 disabled:text-brand-ink/35"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {shippingBenefit && (
            <Field label="Descuento sobre envio (%)">
              <input name="shippingDiscountPercent" type="number" min="1" max="100" defaultValue={coupon?.shippingDiscountPercent || 100} required className="input-admin" />
            </Field>
          )}
          {!shippingBenefit && <input type="hidden" name="shippingDiscountPercent" value="0" />}
          {!priceBenefit && <input type="hidden" name="discountPercent" value="0" />}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <span className="flex items-center gap-2"><ShieldCheck size={15} /> Se guarda como uso único por cliente.</span>
            <label className="flex items-center gap-2 text-brand-ink">
              <input name="active" type="checkbox" defaultChecked={coupon?.active ?? true} className="h-4 w-4 accent-brand-red" /> Activo
            </label>
          </div>

          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 font-semibold">Cancelar</button>
            <button disabled={pending} className="btn-primary">{pending ? "Guardando..." : "Guardar cupón"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductChecklist({ products, selectedIds }: { products: Product[]; selectedIds: string[] }) {
  const [allProducts, setAllProducts] = useState(selectedIds.length === 0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedIds));

  function toggleProduct(id: string, checked: boolean) {
    setAllProducts(false);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <Field label="Productos aplicables">
      <div className="rounded-lg border border-black/10 bg-brand-cream p-2">
        <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-bold text-brand-ink">
          <input
            type="checkbox"
            checked={allProducts}
            onChange={(e) => {
              setAllProducts(e.target.checked);
              if (e.target.checked) setSelected(new Set());
            }}
            className="h-4 w-4 accent-brand-red"
          />
          Todos los productos de la web
        </label>
        {!allProducts && [...selected].map((id) => <input key={id} type="hidden" name="discountProductIds" value={id} />)}
        <div className="max-h-48 overflow-y-auto rounded-md bg-white">
          {products.map((product) => {
            const checked = !allProducts && selected.has(product.id);
            return (
              <label key={product.id} className="flex cursor-pointer items-center gap-2 border-b border-black/5 px-3 py-2 text-xs font-semibold last:border-0 hover:bg-brand-cream/60">
                <input type="checkbox" checked={checked} disabled={allProducts} onChange={(e) => toggleProduct(product.id, e.target.checked)} className="h-4 w-4 accent-brand-red disabled:opacity-40" />
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="text-brand-ink/40">{product.stock} disp.</span>
              </label>
            );
          })}
        </div>
      </div>
    </Field>
  );
}

function DateRangePicker({
  startsAt,
  endsAt,
  onChange,
}: {
  startsAt: string;
  endsAt: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState(startsAt);
  const [draftEnd, setDraftEnd] = useState(endsAt);
  const [cursor, setCursor] = useState(() => {
    const start = dateFromIso(startsAt);
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });
  const start = dateFromIso(draftStart);
  const end = dateFromIso(draftEnd);

  useEffect(() => {
    if (!open) {
      setDraftStart(startsAt);
      setDraftEnd(endsAt);
      setSelectingEnd(false);
    }
  }, [endsAt, open, startsAt]);

  function pick(date: Date) {
    const iso = isoFromDate(date);
    if (!selectingEnd) {
      setDraftStart(iso);
      setDraftEnd(iso);
      setSelectingEnd(true);
      return;
    }
    if (date.getTime() < start.getTime()) {
      setDraftStart(iso);
      setDraftEnd(iso);
      setSelectingEnd(true);
      return;
    }
    setDraftEnd(iso);
    setSelectingEnd(false);
  }

  function clear() {
    const today = todayDate();
    setDraftStart(today);
    setDraftEnd(today);
    setSelectingEnd(false);
    const date = dateFromIso(today);
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function save() {
    onChange(draftStart, draftEnd);
    setSelectingEnd(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-brand-cream px-3 py-2 text-left text-sm font-bold text-brand-ink transition duration-200 hover:-translate-y-0.5 hover:border-brand-red/40 hover:shadow-soft"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="text-brand-red" />
          <span>Elegir fecha</span>
        </span>
        <span className="truncate text-xs font-semibold text-brand-ink/55">
          {formatDisplayDate(startsAt)} al {formatDisplayDate(endsAt)}
        </span>
      </button>

      {open && (
        <div className="coupon-popover-in absolute left-0 top-[calc(100%+8px)] z-[70] w-full max-w-[360px] rounded-xl border border-black/10 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, -1))}
              className="rounded-lg p-1.5 text-brand-ink/60 hover:bg-brand-cream hover:text-brand-ink"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <div className="text-xs font-black text-brand-ink">{monthLabel(cursor)}</div>
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, 1))}
              className="rounded-lg p-1.5 text-brand-ink/60 hover:bg-brand-cream hover:text-brand-ink"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <MonthGrid month={cursor} start={start} end={end} onPick={pick} compact />
          <p className="mt-3 rounded-lg bg-brand-gold/15 px-3 py-2 text-[11px] font-semibold leading-relaxed text-brand-ink/70">
            El cupón será válido desde las 00:00 del {formatDisplayDate(draftStart)} hasta las 23:59 del {formatDisplayDate(draftEnd)}.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-2">
            <button type="button" onClick={clear} className="text-xs font-bold text-brand-ink/55 hover:text-brand-red">
              Borrar fechas
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-brand-ink/45">
                {selectingEnd ? "Elegí fecha final" : "Rango listo"}
              </span>
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-soft"
              >
                Guardar fecha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  month,
  start,
  end,
  onPick,
  compact = false,
}: {
  month: Date;
  start: Date;
  end: Date;
  onPick: (date: Date) => void;
  compact?: boolean;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <div>
      {!compact && <h3 className="mb-3 text-center text-sm font-black text-brand-ink">{monthLabel(month)}</h3>}
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-brand-ink/45">
        {weekdays.map((day) => <div key={day} className="py-1">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className={compact ? "h-8" : "h-10"} />;
          const time = date.getTime();
          const isStart = isoFromDate(date) === isoFromDate(start);
          const isEnd = isoFromDate(date) === isoFromDate(end);
          const isInside = time > start.getTime() && time < end.getTime();
          const isSingleDay = isStart && isEnd;
          const isSelected = isStart || isEnd;
          return (
            <button
              key={isoFromDate(date)}
              type="button"
              onClick={() => onPick(date)}
              className={`group relative flex ${compact ? "h-8" : "h-10"} items-center justify-center text-xs font-bold text-brand-ink transition`}
            >
              {(isInside || (isStart && !isSingleDay) || (isEnd && !isSingleDay)) && (
                <span
                  className={`absolute top-1/2 h-6 -translate-y-1/2 bg-brand-gold/20 ${
                    isInside
                      ? "left-0 right-0"
                      : isStart
                        ? "left-0 right-0 rounded-l-full"
                        : "left-0 right-0 rounded-r-full"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex ${compact ? "h-7 w-7" : "h-9 w-9"} items-center justify-center rounded-full transition duration-150 ${
                  isSelected
                    ? "bg-brand-red text-white shadow-soft"
                    : "group-hover:-translate-y-0.5 group-hover:bg-brand-cream group-hover:text-brand-red"
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckCard({
  name,
  checked,
  onChange,
  icon,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${checked ? "border-brand-red bg-brand-red text-white" : "border-black/10 bg-brand-cream text-brand-ink hover:border-brand-red/40"}`}>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${checked ? "bg-white text-brand-red" : "bg-white text-brand-ink/40"}`}>
        {checked ? <Check size={15} /> : icon}
      </span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className={`block text-xs ${checked ? "text-white/80" : "text-brand-ink/50"}`}>{description}</span>
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-ink/70">{label}</span>
      {children}
    </div>
  );
}
