import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { listAvailableOrders, requireDriver } from "@/server/driver";

/** GET /api/driver/orders/available — заказы рядом, подходящие по классу автомобиля. */
export async function GET() {
  try {
    const { driver } = await requireDriver();
    return NextResponse.json({ items: await listAvailableOrders(driver) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
