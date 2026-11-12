import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

    // Обновляем время последней активности (last_seen_at).
    // ВАЖНО: Замените этот вызов на реальный метод вашей БД.
    // await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
