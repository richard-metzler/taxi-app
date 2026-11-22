import { NextResponse } from "next/server";

/**
 * Отладочный эндпоинт для логирования клиентских сообщений.
 * Доступен только в разработке — в продакшене возвращает 404.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: { code: "not_found", message: "Не найдено" } }, { status: 404 });
  }
  try {
    const { message, data } = await req.json();
    // Ограничиваем размер лога, чтобы избежать переполнения памяти
    const safeMessage = typeof message === "string" ? message.slice(0, 500) : "";
    const safeData = data ? JSON.stringify(data).slice(0, 2000) : "";
    console.log(`[CLIENT] ${safeMessage}`, safeData);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
