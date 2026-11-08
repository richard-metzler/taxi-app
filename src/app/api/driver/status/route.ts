import { NextResponse } from "next/server";
import { Errors, handleApiError } from "@/core/errors";
import { requireDriver, setDriverOnline } from "@/server/driver";

/** POST /api/driver/status — выход на линию (с текущей позицией) или уход с линии. */
export async function POST(req: Request) {
  try {
    const { driver } = await requireDriver();
    const body = (await req.json().catch(() => ({}))) as { online?: unknown; latitude?: unknown; longitude?: unknown };
    if (typeof body.online !== "boolean") throw Errors.validation("Укажите, выходите вы на линию или уходите с неё");
    const result = await setDriverOnline(driver, body.online, { latitude: body.latitude, longitude: body.longitude });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
