import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("[LOG] [Webhook] === ПОЛУЧЕН ЗАПРОС ОТ MAX ===");
  
  try {
    const body = await req.json();
    console.log("[LOG] [Webhook] Тело запроса:", JSON.stringify(body, null, 2));

    // MAX присылает callback в поле payload или callback
    const payload = body.payload || body.callback?.payload;
    if (!payload) {
      console.log("[LOG] [Webhook] Нет payload в запросе");
      return NextResponse.json({ ok: true });
    }

    const [action, orderId] = payload.split(":");
    console.log("[LOG] [Webhook] Действие:", action, "ID заказа:", orderId);

    if (!action || !orderId) {
      console.log("[LOG] [Webhook] Неверный формат payload");
      return NextResponse.json({ ok: true });
    }

    // Пока просто логируем, чтобы проверить, доходит ли запрос
    console.log("[LOG] [Webhook] УСПЕХ! Запрос дошел до сервера.");
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LOG] [Webhook] Ошибка:", error);
    return NextResponse.json({ ok: true });
  }
}

// Для проверки через браузер (GET)
export async function GET() {
  return NextResponse.json({ 
    status: "Webhook работает", 
    hint: "Используйте POST для получения событий от MAX" 
  });
}
