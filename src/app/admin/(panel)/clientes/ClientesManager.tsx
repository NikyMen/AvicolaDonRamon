"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Search, X } from "lucide-react";
import type { Customer } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { saveCustomer, type SaveCustomerState } from "./actions";

type SortKey = "name" | "contact" | "document" | "orders" | "spent";
type SortDirection = "asc" | "desc";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function customerValue(customer: Customer, key: SortKey): string | number {
  switch (key) {
    case "name":
      return customer.name;
    case "contact":
      return `${customer.email} ${customer.phone}`;
    case "document":
      return customer.document ?? "";
    case "orders":
      return customer.orders;
    case "spent":
      return customer.spent;
  }
}

export function ClientesManager({ customers }: { customers: Customer[] }) {
  // null = cerrado, undefined = crear nuevo, Customer = editar
  const [editing, setEditing] = useState<Customer | undefined | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "name",
    direction: "asc",
  });

  const visibleCustomers = useMemo(() => {
    const search = normalize(query.trim());
    return customers
      .filter((customer) =>
        search
          ? normalize(
              [
                customer.name,
                customer.email,
                customer.phone,
                customer.document,
                customer.orders,
                customer.spent,
              ]
                .filter((value) => value !== undefined)
                .join(" ")
            ).includes(search)
          : true
      )
      .slice()
      .sort((a, b) => {
        const aValue = customerValue(a, sort.key);
        const bValue = customerValue(b, sort.key);
        const result =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), "es", {
                numeric: true,
                sensitivity: "base",
              });
        return sort.direction === "asc" ? result : -result;
      });
  }, [customers, query, sort]);

  function changeSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Clientes</h1>
          <p className="text-sm text-brand-ink/55">
            {visibleCustomers.length === customers.length
              ? `${customers.length} clientes registrados`
              : `${visibleCustomers.length} de ${customers.length} clientes`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(undefined)}>
          <Plus size={16} /> Agregar cliente
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="relative max-w-xl">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, contacto o documento"
            aria-label="Buscar clientes"
            className="w-full rounded-xl border border-black/10 bg-brand-cream py-2.5 pl-10 pr-10 text-sm text-brand-ink outline-none transition focus:border-brand-red/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-brand-ink/45 hover:bg-black/5 hover:text-brand-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
              <tr>
                <SortHeader label="Cliente" sortKey="name" sort={sort} onSort={changeSort} />
                <SortHeader label="Contacto" sortKey="contact" sort={sort} onSort={changeSort} />
                <SortHeader label="Documento" sortKey="document" sort={sort} onSort={changeSort} />
                <SortHeader label="Pedidos" sortKey="orders" sort={sort} onSort={changeSort} />
                <SortHeader label="Gastado" sortKey="spent" sort={sort} onSort={changeSort} />
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((c) => (
                <tr key={c.id} className="border-t border-black/5 hover:bg-brand-cream/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">
                        {c.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-brand-ink">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-ink/60">
                    <p>{c.email || "—"}</p>
                    <p className="text-xs">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-brand-ink/70">{c.document || "—"}</td>
                  <td className="px-4 py-3 text-brand-ink/80">{c.orders}</td>
                  <td className="px-4 py-3 font-medium text-brand-ink">{formatARS(c.spent)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
              {visibleCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-ink/50">
                    {customers.length === 0
                      ? "Todavía no hay clientes registrados."
                      : "No hay clientes que coincidan con la búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && <CustomerModal customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 font-semibold" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-brand-red"
      >
        {label}
        <Icon size={13} aria-hidden="true" className={active ? "text-brand-red" : "opacity-45"} />
      </button>
    </th>
  );
}

function CustomerModal({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<SaveCustomerState, FormData>(saveCustomer, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">
            {customer ? "Editar cliente" : "Nuevo cliente"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="space-y-4 text-sm">
          {customer && <input type="hidden" name="id" value={customer.id} />}

          <Field label="Nombre">
            <input name="name" defaultValue={customer?.name} required className="input-admin" />
          </Field>

          <Field label={customer ? "Teléfono (no editable)" : "Teléfono"}>
            <input
              name="phone"
              defaultValue={customer?.phone}
              required={!customer}
              disabled={!!customer}
              className="input-admin disabled:bg-black/5 disabled:text-brand-ink/50"
            />
          </Field>

          <Field label="Correo (opcional)">
            <input name="email" type="email" defaultValue={customer?.email} className="input-admin" />
          </Field>

          <Field label="Documento (DNI/CUIT, opcional)">
            <input name="document" defaultValue={customer?.document} className="input-admin" />
          </Field>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{state.error}</p>
          )}

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
