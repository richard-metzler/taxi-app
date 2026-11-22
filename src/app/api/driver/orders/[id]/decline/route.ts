import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { declineOffer, requireDriver } from "@/server/driver";

/** POST /api/driver/orders/:id/decline — отказаться от ещё не принятого оффера. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { driver } = await requireDriver();
    const { id } = await ctx.params;
    await declineOffer(driver, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
