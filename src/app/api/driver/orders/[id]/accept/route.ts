import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { acceptOrder, requireDriver } from "@/server/driver";

/** POST /api/driver/orders/:id/accept — принять заказ (статус меняет сервер). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { driver } = await requireDriver();
    const { id } = await ctx.params;
    await acceptOrder(driver, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
