"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/** Botón que cierra la sesión y redirige al login correspondiente. */
export function LogoutButton({
  className,
  redirectTo = "/ingresar",
}: {
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={logout} disabled={loading} className={className}>
      <LogOut size={18} /> Cerrar sesión
    </button>
  );
}
