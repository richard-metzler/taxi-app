import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { listDriverTrips, requireDriver } from "@/server/driver";

/** GET /api/driver/orders/history — поездки водителя. Чужие заказы недоступны. */
export async function GET() {
  try {
    const { driver } = await requireDriver();
    return NextResponse.json({ items: await listDriverTrips(driver) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
