import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { performDriverAction } from "@/server/driver";
import { sendMaxNotification } from "@/shared/max-notify";

const APP_URL = "https://taxi-app.layero.app";

export async function POST(req: Request) {
  console.log("[LOG] [Webhook] === ПОЛУЧЕН ЗАПРОС ОТ MAX ===");
  
  try {
    const body = await req.json();
    
    // MAX присылает callback в поле callback
    const callback = body.callback;
    if (!callback || !callback.payload) {
      console.log("[LOG] [Webhook] Нет callback.payload");
      return NextResponse.json({ ok: true });
    }

    const payload = callback.payload;
    const userId = callback.user?.user_id;
    
    console.log("[LOG] [Webhook] Payload:", payload, "User ID:", userId);

    const [action, orderId] = payload.split(":");
    if (!action || !orderId || !userId) {
      console.log("[LOG] [Webhook] Неверный формат или нет user_id");
      return NextResponse.json({ ok: true });
    }

    // Находим водителя по user_id (из MAX)
    const [driverData] = await db.select({ driver: drivers }).from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(eq(users.phone, `max_${userId}`));

    if (!driverData) {
      console.warn("[LOG] [Webhook] Водитель не найден для user_id:", userId);
      return NextResponse.json({ ok: true });
    }

    const driver = driverData.driver;

    if (action === "accept_order") {
      try {
        await performDriverAction(driver, orderId, "accept");
        
        // Отправляем сообщение с кнопкой "Открыть приложение"
        const keyboard = {
          buttons: [
            [
              { 
                type: "open_app", 
                text: "🚀 Открыть приложение", 
                web_app: { url: APP_URL } 
              }
            ]
          ]
        };
        
        await sendMaxNotification(
          userId, 
          "✅ Заказ принят! Нажмите кнопку ниже, чтобы открыть приложение и начать поездку.",
          keyboard
        );
        console.log("[LOG] [Webhook] Заказ принят, отправлено сообщение с кнопкой.");
      } catch (e) {
        console.error("[LOG] [Webhook] Ошибка принятия:", e);
        await sendMaxNotification(userId, "❌ Не удалось принять заказ. Возможно, его уже забрали.");
      }
    } else if (action === "decline_order") {
      try {
        await performDriverAction(driver, orderId, "decline");
        await sendMaxNotification(userId, "❌ Вы отказались от заказа.");
      } catch (e) {
        console.error("[LOG] [Webhook] Ошибка отказа:", e);
        await sendMaxNotification(userId, "❌ Не удалось отказаться от заказа.");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LOG] [Webhook] Ошибка:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "Webhook работает", 
    hint: "Используйте POST для получения событий от MAX" 
  });
}
