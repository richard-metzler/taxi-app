import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { getOrderView } from "@/server/orders";

/** GET /api/orders/:id — актуальное состояние заказа, водителя и платежа. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePassenger();
    const { id } = await ctx.params;
    const order = await getOrderView(user, id);
    return NextResponse.json({ order });
  } catch (e) {
    return handleApiError(e);
  }
}
