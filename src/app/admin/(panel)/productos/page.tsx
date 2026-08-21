import { listProducts } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { ProductsManager } from "./ProductsManager";

export const dynamic = "force-dynamic";

export default async function AdminProductosPage() {
  await requirePerm("productos");
  const products = await listProducts();
  return <ProductsManager products={products} />;
}
