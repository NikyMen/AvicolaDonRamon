import { cn } from "@/lib/cn";
import Image from "next/image";

export function ConsultoriaDigitalLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image src="/logo-cd.webp" alt="Consultoría Digital" width={384} height={160} className="h-10 w-auto object-contain" />
    </div>
  );
}
