import { contarPausadosEnMasa, listProducts } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { ProductsManager } from "./ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductosPage() {
  await requirePerm("productos");
  const [products, pausados] = await Promise.all([listProducts(), contarPausadosEnMasa()]);
  return <ProductsManager products={products} pausados={pausados} />;
}
