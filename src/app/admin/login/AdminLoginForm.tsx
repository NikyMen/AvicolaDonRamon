"use client";

import { useActionState } from "react";
import { Lock, User } from "lucide-react";
import { adminLogin, type AdminLoginState } from "./actions";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminLogin, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-brand-ink">Usuario</span>
        <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-brand-cream px-3 py-2">
          <User size={16} className="text-brand-ink/40" />
          <input
            name="user"
            autoComplete="username"
            required
            className="w-full bg-transparent outline-none placeholder:text-brand-ink/40"
            placeholder="admin"
          />
        </div>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-brand-ink">Contraseña</span>
        <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-brand-cream px-3 py-2">
          <Lock size={16} className="text-brand-ink/40" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full bg-transparent outline-none placeholder:text-brand-ink/40"
            placeholder="••••••••"
          />
        </div>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full justify-center">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
