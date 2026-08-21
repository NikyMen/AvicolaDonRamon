import { listCoupons, listProducts } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { CouponsManager } from "./CouponsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePerm("cupones");
  const [coupons, products] = await Promise.all([
    listCoupons(),
    listProducts({ available: true }),
  ]);
  return <CouponsManager coupons={coupons} products={products} />;
}
