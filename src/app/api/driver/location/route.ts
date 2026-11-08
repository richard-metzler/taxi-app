import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requireDriver, updateDriverLocation } from "@/server/driver";

/** POST /api/driver/location — текущая позиция водителя (видна пассажиру во время заказа). */
export async function POST(req: Request) {
  try {
    const { driver } = await requireDriver();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await updateDriverLocation(driver, body);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
