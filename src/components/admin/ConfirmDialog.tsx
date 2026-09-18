"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  pending = false,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              danger ? "bg-red-100 text-red-700" : "bg-brand-red/10 text-brand-red"
            )}
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 pt-1">
            <h2 className="font-semibold text-brand-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-brand-ink/60">{description}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink/70 hover:bg-black/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60",
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-red hover:bg-brand-red/90"
            )}
          >
            {pending ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
