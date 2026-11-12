import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

    // Просто обновляем время активности
    await db.update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Heartbeat API] Ошибка:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
