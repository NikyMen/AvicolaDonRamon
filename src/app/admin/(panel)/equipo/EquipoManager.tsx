"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Staff, StaffRole } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PERM_MODULES } from "@/lib/auth/perm-modules";
import { saveStaff, toggleStaffActive, removeStaff, type SaveStaffState } from "./actions";

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "cajero", label: "Cajero/a" },
  { value: "cocina", label: "Cocina" },
  { value: "repartidor", label: "Repartidor/a" },
  { value: "encargado", label: "Encargado/a" },
  { value: "admin", label: "Administrador/a" },
];

const roleColors: Record<StaffRole, string> = {
  cajero: "bg-sky-100 text-sky-700",
  cocina: "bg-orange-100 text-orange-700",
  repartidor: "bg-violet-100 text-violet-700",
  encargado: "bg-amber-100 text-amber-700",
  admin: "bg-emerald-100 text-emerald-700",
};

const roleLabel = (r: StaffRole) => ROLES.find((x) => x.value === r)?.label ?? r;

export function EquipoManager({ team }: { team: Staff[] }) {
  const [editing, setEditing] = useState<Staff | undefined | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Equipo</h1>
          <p className="text-sm text-brand-ink/55">{team.length} integrantes del equipo</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(undefined)}>
          <Plus size={16} /> Agregar integrante
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs uppercase tracking-wide text-brand-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Integrante</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Contacto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {team.map((s) => (
                <tr key={s.id} className="border-t border-black/5 hover:bg-brand-cream/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink text-sm font-bold text-white">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-brand-ink">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("chip", roleColors[s.role])}>{roleLabel(s.role)}</span>
                  </td>
                  <td className="px-4 py-3 text-brand-ink/60">
                    <p>{s.phone || "—"}</p>
                    {s.email && <p className="text-xs">{s.email}</p>}
                    {s.username && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-ink/70">
                        <KeyRound size={12} /> {s.username}
                        <span className="text-brand-ink/40">
                          · {s.permissions.length} {s.permissions.length === 1 ? "acceso" : "accesos"}
                        </span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStaffActive(s.id, !s.active)}
                      title="Cambiar estado"
                      className={cn(
                        "chip cursor-pointer",
                        s.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {s.active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setEditing(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink/70 hover:bg-black/5"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${s.name} del equipo?`)) removeStaff(s.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-brand-ink/50">
                    Todavía no hay integrantes cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && <StaffModal member={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StaffModal({ member, onClose }: { member?: Staff; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<SaveStaffState, FormData>(saveStaff, {});

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
            {member ? "Editar integrante" : "Nuevo integrante"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-brand-ink/50 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="space-y-4 text-sm">
          {member && <input type="hidden" name="id" value={member.id} />}

          <Field label="Nombre">
            <input name="name" defaultValue={member?.name} required className="input-admin" />
          </Field>

          <Field label="Rol">
            <select name="role" defaultValue={member?.role ?? "cajero"} className="input-admin">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono (opcional)">
              <input name="phone" defaultValue={member?.phone} className="input-admin" />
            </Field>
            <Field label="Correo (opcional)">
              <input name="email" type="email" defaultValue={member?.email} className="input-admin" />
            </Field>
          </div>

          <label className="flex items-center gap-2 font-semibold text-brand-ink">
            <input
              name="active"
              type="checkbox"
              defaultChecked={member?.active ?? true}
              className="h-4 w-4 accent-brand-red"
            />
            Activo
          </label>

          {/* Acceso al panel: usuario, contraseña y permisos por módulo. */}
          <div className="space-y-3 rounded-xl border border-black/10 bg-brand-cream/40 p-4">
            <div className="flex items-center gap-2 font-semibold text-brand-ink">
              <KeyRound size={15} /> Acceso al panel
            </div>
            <p className="text-xs text-brand-ink/55">
              Definí un usuario y contraseña para que pueda iniciar sesión, y marcá a qué secciones
              accede. Dejá el usuario vacío si es solo un contacto del equipo.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario">
                <input
                  name="username"
                  defaultValue={member?.username}
                  autoComplete="off"
                  className="input-admin"
                />
              </Field>
              <Field label={member?.hasPassword ? "Contraseña (dejar vacío = no cambia)" : "Contraseña"}>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={member?.hasPassword ? "••••••" : ""}
                  className="input-admin"
                />
              </Field>
            </div>

            <div>
              <span className="mb-1 block font-semibold text-brand-ink">Permisos</span>
              <div className="grid grid-cols-2 gap-2">
                {PERM_MODULES.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-brand-ink/80"
                  >
                    <input
                      name="permissions"
                      value={m.key}
                      type="checkbox"
                      defaultChecked={member?.permissions?.includes(m.key)}
                      className="h-4 w-4 accent-brand-red"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

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
