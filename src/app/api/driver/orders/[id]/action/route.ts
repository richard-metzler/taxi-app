import { NextResponse } from "next/server";
import { handleApiError } from "@/core/errors";
import { sendMaxNotification } from "@/shared/max-notify";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { performDriverAction, requireDriver } from "@/server/driver";

/** POST /api/driver/orders/:id/action — depart | arrived | start | complete | decline. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { driver } = await requireDriver();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { action?: unknown };
    const result = await performDriverAction(driver, id, body.action);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleApiError(e);
  }
}
