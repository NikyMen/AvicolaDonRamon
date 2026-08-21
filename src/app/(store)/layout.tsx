import { StoreHeader } from "@/components/store/StoreHeader";
import { BottomNav } from "@/components/store/BottomNav";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SideMenu } from "@/components/store/SideMenu";
import { Footer } from "@/components/store/Footer";
import { VisitTracker } from "@/components/store/VisitTracker";
import { Toaster } from "@/components/store/Toaster";
import { FloatingActions } from "@/components/store/FloatingActions";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-cream">
      <VisitTracker />
      <StoreHeader />
      <main className="flex-1 pb-20 md:pb-12">
        {/* Ancho completo en mobile; contenido centrado y amplio en escritorio */}
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
      <Footer />
      {/* Navegación inferior solo en mobile */}
      <div className="md:hidden">
        <BottomNav />
      </div>
      <CartDrawer />
      <SideMenu />
      <FloatingActions />
      <Toaster />
    </div>
  );
}
