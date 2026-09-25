import { requirePerm } from "@/lib/auth/permissions";
import { listWholesaleProducts } from "@/lib/wholesale";
import { WholesaleManager } from "./WholesaleManager";

export const dynamic = "force-dynamic";

export default async function AdminMayoristaPage() {
  await requirePerm("productos");
  const products = await listWholesaleProducts();
  return <WholesaleManager products={products} />;
}
