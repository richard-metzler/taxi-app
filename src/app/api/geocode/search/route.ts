import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { searchAddresses } from "@/server/geocoding";

/** GET /api/geocode/search?q=...&lat=..&lng=.. — подсказки адресов. */
export async function GET(req: Request) {
  try {
    await requirePassenger();
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const near = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { latitude: lat, longitude: lng } : null;
    const items = await searchAddresses(q, near);
    return NextResponse.json({ items });
  } catch (e) {
    return handleApiError(e);
  }
}
