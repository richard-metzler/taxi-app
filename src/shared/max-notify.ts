/** Inline-клавиатура MAX: совместима с форматом, который строит сервер заказов. */
type MaxKeyboard = {
  type?: string;
  buttons: unknown[][];
};

export async function sendMaxNotification(userId: string | number, text: string, keyboard?: MaxKeyboard) {
  console.log(`[LOG] [MAX Bot] Попытка отправки. User ID: ${userId}`);

  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error("❌ [LOG] [MAX Bot] ОШИБКА: Переменная MAX_BOT_TOKEN не задана.");
    return false;
  }

  try {
    const body: Record<string, unknown> = { text };
    if (keyboard) {
      // MAX ожидает поле keyboard с типом inline; orders.ts передаёт только buttons.
      body.keyboard = { type: "inline", ...keyboard };
    }

    const response = await fetch(`https://platform-api2.max.ru/messages?user_id=${userId}`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ [LOG] [MAX Bot] ОШИБКА API (статус ${response.status}):`, responseText);
      return false;
    }

    console.log(`✅ [LOG] [MAX Bot] УСПЕШНО отправлено ${userId}.`);
    return true;
  } catch (error) {
    console.error(`❌ [LOG] [MAX Bot] СЕТЕВАЯ ОШИБКА:`, error);
    return false;
  }
}
