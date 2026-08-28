import { cn } from "@/lib/cn";

export function ConsultoriaDigitalLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className="h-8 w-8 shrink-0"
        fill="none"
      >
        <defs>
          <linearGradient id="consultoria-digital-gradient" x1="5" y1="5" x2="35" y2="35" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ef4444" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M28.8 11.2a12 12 0 1 0 0 17.6"
          stroke="url(#consultoria-digital-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="m24 8 7 3-3 7" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">
          Desarrollado por
        </span>
        <span className="text-xs font-bold text-brand-ink">Consultoría Digital</span>
      </span>
    </div>
  );
}
