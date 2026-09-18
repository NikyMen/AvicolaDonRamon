"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AdminSearchState {
  query: string;
  setQuery: (value: string) => void;
}

const AdminSearchContext = createContext<AdminSearchState | null>(null);

export function AdminSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <AdminSearchContext.Provider value={value}>{children}</AdminSearchContext.Provider>;
}

/** Buscador compartido con el header del panel. `null` fuera del provider. */
export function useAdminSearch(): AdminSearchState | null {
  return useContext(AdminSearchContext);
}
