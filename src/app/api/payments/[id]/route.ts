import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { getOwnPayment } from "@/server/yookassa";

/** GET /api/payments/:id — статус платежа (синхронизируется с ЮKassa). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePassenger();
    const { id } = await ctx.params;
    const p = await getOwnPayment(user, id);
    return NextResponse.json({
      payment: { id: p.id, status: p.status, amount: p.amount, paymentMethod: p.paymentMethod, failureReason: p.failureReason },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
