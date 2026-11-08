import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { cancelOrder } from "@/server/orders";

/** POST /api/orders/:id/cancel — отмена заказа пассажиром. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePassenger();
    const { id } = await ctx.params;
    const order = await cancelOrder(user, id);
    return NextResponse.json({ status: order.status });
  } catch (e) {
    return handleApiError(e);
  }
}
