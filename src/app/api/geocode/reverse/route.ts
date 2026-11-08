import { NextResponse } from "next/server";
import { Errors, handleApiError } from "@/core/errors";
import { isValidLatLng } from "@/core/geo";
import { requirePassenger } from "@/server/auth";
import { reverseGeocode } from "@/server/geocoding";

/** GET /api/geocode/reverse?lat=..&lng=.. — адрес по координатам. */
export async function GET(req: Request) {
  try {
    await requirePassenger();
    const url = new URL(req.url);
    const point = { latitude: Number(url.searchParams.get("lat")), longitude: Number(url.searchParams.get("lng")) };
    if (!isValidLatLng(point)) throw Errors.validation("Некорректные координаты");
    const item = await reverseGeocode(point);
    return NextResponse.json({ item });
  } catch (e) {
    return handleApiError(e);
  }
}
