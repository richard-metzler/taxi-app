import { NextResponse } from "next/server";
import { Errors, handleApiError } from "@/core/errors";
import { requirePassenger } from "@/server/auth";
import { createPayment, isYooKassaConfigured } from "@/server/yookassa";
import { publicOrigin } from "@/server/request-origin";

/** GET /api/payments — доступность платёжного провайдера. */
export async function GET() {
  return NextResponse.json({ configured: isYooKassaConfigured(), provider: "yookassa" });
}

/** POST /api/payments — createPayment: сервер создаёт платёж в ЮKassa. */
export async function POST(req: Request) {
  try {
    const user = await requirePassenger();
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) throw Errors.validation("Не указан заказ");
    // Страница возврата не подтверждает оплату — статус проверяется у ЮKassa на сервере.
    const returnUrl = `${publicOrigin(req)}/payment-return?orderId=${encodeURIComponent(orderId)}`;
    const payment = await createPayment(user, orderId, returnUrl);
    return NextResponse.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        confirmationUrl: payment.confirmationUrl,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
