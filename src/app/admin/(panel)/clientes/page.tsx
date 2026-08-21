import { listCustomers } from "@/lib/repo";
import { requirePerm } from "@/lib/auth/permissions";
import { ClientesManager } from "./ClientesManager";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requirePerm("clientes");
  const customers = await listCustomers();
  return <ClientesManager customers={customers} />;
}
