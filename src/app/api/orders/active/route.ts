import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { getActiveOrderIds } from "@/server/orders";

/** GET /api/orders/active — id активного заказа для восстановления состояния. */
export async function GET() {
  try {
    const user = await requirePassenger();
    const result = await getActiveOrderIds(user);
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
