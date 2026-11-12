import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, isOnline } = await req.json();
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

    // Обновляем время последней активности в вашей БД.
    // ВАЖНО: Замените этот вызов на реальный метод вашей ORM/БД.
    // Например, если вы используете Prisma:
    // await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date(), isOnline } });
    
    console.log(`[Presence] User ${userId} is ${isOnline ? "online" : "offline"}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
