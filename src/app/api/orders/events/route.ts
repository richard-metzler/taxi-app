import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { listRecentEvents } from "@/server/orders";

/** GET /api/orders/events?since=ISO — новые события по заказам (in-app уведомления). */
export async function GET(req: Request) {
  try {
    const user = await requirePassenger();
    const since = new URL(req.url).searchParams.get("since");
    const items = await listRecentEvents(user, since);
    return NextResponse.json({ items, now: new Date().toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
