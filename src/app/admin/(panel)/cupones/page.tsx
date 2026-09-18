import { listCoupons, listProducts } from "@/lib/repo";
import { canManageCoupons } from "@/lib/auth/coupon-access";
import { requirePerm } from "@/lib/auth/permissions";
import { CouponsManager } from "./CouponsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePerm("cupones");
  const [coupons, products] = await Promise.all([
    listCoupons(),
    listProducts({ available: true }),
  ]);
  const canManage = await canManageCoupons();
  return <CouponsManager coupons={coupons} products={products} canManageCoupons={canManage} />;
}
