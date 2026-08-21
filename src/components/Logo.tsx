import Image from "next/image";
import { cn } from "@/lib/cn";

/** Identidad visual principal de la tienda. */
export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.jpg"
        alt="Avícola Don Ramón"
        width={48}
        height={48}
        priority
        unoptimized
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.25em]",
            dark ? "text-white/70" : "text-brand-gold"
          )}
        >
          Avícola
        </span>
        <span
          className={cn(
            "font-display text-xl font-bold italic",
            dark ? "text-white" : "text-brand-red"
          )}
        >
          Don Ramón
        </span>
      </div>
    </div>
  );
}
