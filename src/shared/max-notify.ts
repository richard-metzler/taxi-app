export async function sendMaxNotification(userId: string | number, text: string) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error("❌ [MAX Bot] Переменная MAX_BOT_TOKEN не задана.");
    return;
  }
  try {
    const response = await fetch(`https://platform-api2.max.ru/messages?user_id=${userId}`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      console.error(`❌ [MAX Bot] Ошибка (User: ${userId}):`, await response.text());
    } else {
      console.log(`✅ [MAX Bot] Уведомление отправлено ${userId}`);
    }
  } catch (error) {
    console.error(`❌ [MAX Bot] Сеть (User: ${userId}):`, error);
  }
}
