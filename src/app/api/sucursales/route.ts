import { NextResponse } from "next/server";
import { listSucursales } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const branches = await listSucursales();
  return NextResponse.json(
    branches.map(({ id, name, street, number, region, address, mapsUrl, lat, lng }) => ({
      id,
      name,
      street,
      number,
      region,
      address,
      mapsUrl,
      lat,
      lng,
    }))
  );
}
