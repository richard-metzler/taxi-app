import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { acceptOrder, performDriverAction } from "@/server/driver";
import { sendMaxNotification } from "@/shared/max-notify";

const APP_URL = "https://taxi-app.layero.app";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[LOG] [Webhook] Получен callback:", JSON.stringify(body.callback?.payload || body.payload));

    const callbackData = body.callback;
    if (!callbackData) return NextResponse.json({ ok: true });

    const payload = callbackData.payload;
    if (!payload) return NextResponse.json({ ok: true });

    const [action, orderId] = payload.split(":");
    const userId = callbackData.user?.user_id;

    console.log("[LOG] [Webhook] Действие:", action, "ID заказа:", orderId, "User ID:", userId);

    if (!userId) return NextResponse.json({ ok: true });

    // Находим водителя
    const [driverData] = await db.select({ driver: drivers }).from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(eq(users.phone, `max_${userId}`));

    if (!driverData) {
      console.warn("[LOG] [Webhook] Водитель не найден:", userId);
      return NextResponse.json({ ok: true });
    }

    const driver = driverData.driver;

    if (action === "accept_order") {
      try {
        // 🔥 ПРАВИЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРИНЯТИЯ ЗАКАЗА
        await acceptOrder(driver, orderId);
        console.log("[LOG] [Webhook] Заказ успешно принят");
        
        const keyboard = {
          buttons: [
            [{ type: "open_app", text: "🚀 Открыть приложение", web_app: { url: APP_URL } }]
          ]
        };
        
        await sendMaxNotification(
          userId, 
          "✅ Заказ принят! Нажмите кнопку ниже, чтобы открыть приложение.",
          keyboard
        );
      } catch (e: any) {
        console.error("[LOG] [Webhook] Ошибка принятия:", e.message);
        await sendMaxNotification(userId, `❌ Не удалось принять заказ: ${e.message}`);
      }
    } else if (action === "decline_order") {
      try {
        await performDriverAction(driver, orderId, "decline");
        console.log("[LOG] [Webhook] Отказ выполнен");
        await sendMaxNotification(userId, "❌ Вы отказались от заказа.");
      } catch (e: any) {
        console.error("[LOG] [Webhook] Ошибка отказа:", e.message);
        await sendMaxNotification(userId, `❌ Не удалось отказаться: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[LOG] [Webhook] Общая ошибка:", error.message);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Webhook работает" });
}
