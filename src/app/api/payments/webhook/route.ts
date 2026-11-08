import { NextResponse } from "next/server";
import { handleWebhook } from "@/server/yookassa";

/**
 * POST /api/payments/webhook — уведомления ЮKassa.
 * Статус платежа подтверждается повторным запросом к API ЮKassa, телу уведомления не доверяем.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await handleWebhook(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] Ошибка обработки:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
