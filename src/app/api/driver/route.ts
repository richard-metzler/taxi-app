import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { getDriverState, requireDriver } from "@/server/driver";

/** GET /api/driver — профиль водителя, автомобиль и текущий заказ. */
export async function GET() {
  try {
    const { driver } = await requireDriver();
    return NextResponse.json(await getDriverState(driver), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
