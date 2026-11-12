import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId, isOnline } = await req.json();
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

    await db.update(users)
      .set({ isOnline, lastSeenAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Presence API] Ошибка:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
