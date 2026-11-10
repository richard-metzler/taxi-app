import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [result] = await db
      .select({ value: count() })
      .from(drivers)
      .where(
        and(
          eq(drivers.isOnline, true),
          eq(drivers.isBusy, false),
          eq(drivers.isApproved, true)
        )
      );
      
    return NextResponse.json({ count: Number(result.value) });
  } catch (error) {
    console.error("[system/status] Ошибка:", error);
    return NextResponse.json({ count: 0 });
  }
}
